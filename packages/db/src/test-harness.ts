import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Provider, type ProviderToken, provide, testBed } from "@brika/di";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Db } from "./client";
import {
  regDistTags,
  regPackages,
  regScopeMembers,
  regScopes,
  regSearch,
  regVersions,
  schema,
} from "./index";

/**
 * Shared in-memory test harness for the `reg_*` schema: a real bun:sqlite database with the
 * package's shipped migrations applied, so the real code paths run without the Cloudflare runtime.
 */

const MIGRATIONS_DIR = join(import.meta.dir, "../drizzle");

/** A real in-memory drizzle Db with the migrations applied. */
export function makeDb(): Db {
  const sqlite = new Database(":memory:");
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  }
  return drizzle(sqlite, { schema }) as unknown as Db;
}

/**
 * Build a field-injected D1 adapter over `db` for a test, e.g. `makeAdapter(db, D1ScopeStore)`. Pass
 * `extra` providers for an adapter that injects sibling ports (e.g. the ownership policy's deps).
 */
export function makeAdapter<T>(db: Db, adapter: ProviderToken<T>, ...extra: Provider[]): T {
  return testBed(provide(Db, db), ...extra).inject(adapter);
}

/**
 * Seed the canonical example package across registry tests: `@brika/x@1.0.0`, the `@brika` scope
 * (with `owner` as admin so membership-based publish authorization passes), and the `latest` tag.
 */
export async function seedExamplePackage(db: Db, owner: string): Promise<void> {
  await db.insert(regScopes).values({ scope: "@brika" });
  await db.insert(regScopeMembers).values({ scope: "@brika", userId: owner, role: "admin" });
  await db.insert(regPackages).values({ name: "@brika/x", scope: "@brika" });
  await db.insert(regVersions).values({
    name: "@brika/x",
    version: "1.0.0",
    manifest: { name: "@brika/x", version: "1.0.0" },
    integrity: "sha512-test",
    shasum: "deadbeef",
    size: 1,
  });
  await db.insert(regDistTags).values({ name: "@brika/x", tag: "latest", version: "1.0.0" });
  // Mirror the search projection a real publish would build, so engine-backed reads see the seed.
  await db.insert(regSearch).values({ name: "@brika/x", version: "1.0.0" });
}
