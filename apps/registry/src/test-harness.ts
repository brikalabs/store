import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Db, schema } from "@brika/store-db";
import { drizzle } from "drizzle-orm/bun-sqlite";

/**
 * Shared in-memory test harness for the registry. Builds a real bun:sqlite
 * database by applying the same drizzle migrations the registry ships, wrapped
 * as a drizzle `Db`, plus a minimal fake R2 bucket. This mirrors the harness in
 * `controllers/handlers.test.ts` so adapter and controller tests run the real
 * code paths end to end without the Cloudflare runtime.
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
