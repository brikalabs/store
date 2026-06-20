import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PluginDetail } from "@brika/registry-contract";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { users } from "@/server/db/schema";
import { applyListingOverride, getPluginListing, upsertPluginListing } from "./listing";

/** In-memory store D1 with every shipped migration applied (sorted). */
function makeDb(): Db {
  const sqlite = new Database(":memory:");
  const dir = join(import.meta.dir, "../../drizzle");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const stmt of readFileSync(join(dir, file), "utf8").split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  }
  return drizzle(sqlite, { schema }) as unknown as Db;
}

let db: Db;
beforeEach(async () => {
  db = makeDb();
  await db.insert(users).values({ id: "gh_1", githubId: 1, login: "alice", name: "Alice" });
});

describe("plugin listing CRUD", () => {
  test("CONSOLE-005-AC1: upsert then read round-trips, and update replaces", async () => {
    expect(await getPluginListing(db, "@acme/x")).toBeNull();

    await upsertPluginListing(db, "@acme/x", "gh_1", {
      displayName: "Acme X",
      summary: "Short",
      description: "Full text",
      visibility: "public",
    });
    expect(await getPluginListing(db, "@acme/x")).toEqual({
      displayName: "Acme X",
      summary: "Short",
      description: "Full text",
      visibility: "public",
    });

    await upsertPluginListing(db, "@acme/x", "gh_1", {
      displayName: null,
      summary: null,
      description: "Edited",
      visibility: "unlisted",
    });
    expect(await getPluginListing(db, "@acme/x")).toMatchObject({
      displayName: null,
      description: "Edited",
      visibility: "unlisted",
    });
  });
});

describe("applyListingOverride", () => {
  const detail = {
    name: "@acme/x",
    displayName: "Manifest Name",
    description: "Manifest description",
  } as unknown as PluginDetail;

  test("null override leaves the detail unchanged", () => {
    expect(applyListingOverride(detail, null)).toBe(detail);
  });

  test("CONSOLE-005-AC2: set fields override; null fields fall through to the manifest", () => {
    const merged = applyListingOverride(detail, {
      displayName: "Override Name",
      description: null,
    });
    expect(merged.displayName).toBe("Override Name");
    expect(merged.description).toBe("Manifest description");
  });
});
