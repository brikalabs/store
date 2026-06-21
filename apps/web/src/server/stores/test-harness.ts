import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

/**
 * A real in-memory SQLite over the store/social schema, built from the same drizzle migrations
 * the app ships, wrapped as the store `Db`. The store's `Db` is a D1 client; bun:sqlite exposes
 * the same query API, so the repository code runs unchanged here. Shared by every store/service
 * test so the schema setup lives in one place.
 *
 * Migrations are discovered from the `drizzle/` dir (the same scan the `@brika/db` harness uses),
 * sorted by their zero-padded numeric prefix = apply order, so a newly generated migration is
 * picked up automatically - no hand-kept list to drift out of sync with what the app ships.
 */

const MIGRATIONS_DIR = join(import.meta.dir, "../../../drizzle");

export function makeStoreDb(): Db {
  const sqlite = new Database(":memory:");
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  }
  return drizzle(sqlite, { schema }) as unknown as Db;
}
