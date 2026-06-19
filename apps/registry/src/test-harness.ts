import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Db,
  regDistTags,
  regPackages,
  regScopeMembers,
  regScopes,
  regVersions,
  schema,
} from "@brika/store-db";
import { drizzle } from "drizzle-orm/bun-sqlite";

/**
 * Shared in-memory test harness for the registry. Builds a real bun:sqlite
 * database by applying the same drizzle migrations the registry ships, wrapped
 * as a drizzle `Db`, plus a minimal fake R2 bucket and a canonical package seed.
 * Adapter and controller tests import these so they run the real code paths end
 * to end without the Cloudflare runtime, and share one definition (no per-file copy).
 */

const MIGRATIONS_DIR = join(import.meta.dir, "../../../packages/db/drizzle");

/** A real in-memory drizzle Db with the registry migrations applied. */
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

/** Minimal in-memory R2 bucket: only the get/put/delete the adapters use. */
export function fakeR2(): R2Bucket {
  const store = new Map<string, Uint8Array>();
  const bucket = {
    get: async (key: string) => {
      const bytes = store.get(key);
      return bytes === undefined ? null : { body: new Response(bytes).body };
    },
    put: async (key: string, value: Uint8Array) => {
      store.set(key, value);
      return {};
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
  return bucket as unknown as R2Bucket;
}

/**
 * Seed the canonical example package used across the registry tests: `@brika/x@1.0.0`
 * plus its `@brika` scope (owned by `owner`, who is seeded as the scope's admin member
 * so membership-based publish authorization passes) and `latest` dist-tag. Token
 * issuance is left to the caller, since only the auth-facing tests need one.
 */
export async function seedExamplePackage(db: Db, owner: string): Promise<void> {
  await db.insert(regScopes).values({ scope: "@brika", ownerId: owner });
  await db
    .insert(regScopeMembers)
    .values({ scope: "@brika", provider: "github", memberId: owner, role: "admin" });
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
}
