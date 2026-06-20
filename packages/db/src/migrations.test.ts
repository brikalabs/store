import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the ORG-001/002 data-reshaping migration: 0009 (additive + backfill) turns the
 * old 1:1 scope-ownership model into the 1:N org model, and 0010 drops the moved columns.
 * Applying every migration to a fresh DB only exercises the DDL on empty tables, so this
 * test applies through 0008, seeds real scope/member rows, then applies 0009/0010 and
 * asserts the backfill reshaped them correctly.
 */

const DRIZZLE = join(import.meta.dir, "../drizzle");

function apply(sqlite: Database, files: string[]): void {
  for (const file of files) {
    for (const stmt of readFileSync(join(DRIZZLE, file), "utf8").split(
      "--> statement-breakpoint",
    )) {
      const trimmed = stmt.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  }
}

describe("0009/0010 org migration backfill", () => {
  test("reshapes existing scope + member rows into orgs", () => {
    const sqlite = new Database(":memory:");
    const all = readdirSync(DRIZZLE)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const additive = all.findIndex((f) => f.startsWith("0009"));
    expect(additive).toBeGreaterThan(0);

    apply(sqlite, all.slice(0, additive)); // through 0008 (old scope model)
    sqlite.run(
      "INSERT INTO reg_scopes (scope, owner_provider, github_owner, display_name, created_at) VALUES ('@acme','github','acme-co','Acme Inc',100), ('@acme-labs','github','acme-co',NULL,200)",
    );
    sqlite.run(
      "INSERT INTO reg_scope_members (scope, provider, member_id, role, created_at) VALUES ('@acme','github','acme-co','admin',100), ('@acme','github','bob','member',150), ('@acme-labs','github','acme-co','admin',200)",
    );
    apply(sqlite, all.slice(additive)); // 0009 backfill + 0010 drops

    expect(sqlite.query("SELECT slug, display_name FROM reg_orgs ORDER BY slug").all()).toEqual([
      { slug: "acme", display_name: "Acme Inc" },
      { slug: "acme-labs", display_name: null },
    ]);
    expect(sqlite.query("SELECT scope, org_id FROM reg_scopes ORDER BY scope").all()).toEqual([
      { scope: "@acme", org_id: "acme" },
      { scope: "@acme-labs", org_id: "acme-labs" },
    ]);
    expect(
      sqlite
        .query("SELECT org_slug, member_id, role FROM reg_org_members ORDER BY org_slug, member_id")
        .all(),
    ).toEqual([
      { org_slug: "acme", member_id: "acme-co", role: "admin" },
      { org_slug: "acme", member_id: "bob", role: "member" },
      { org_slug: "acme-labs", member_id: "acme-co", role: "admin" },
    ]);

    // 0010 dropped the legacy table + columns.
    expect(
      sqlite
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name='reg_scope_members'")
        .all(),
    ).toEqual([]);
  });
});
