import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { transactionalDb } from "@brika/tx";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { Db, RawDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";

/**
 * A real in-memory SQLite over the store/social schema, built from the app's drizzle migrations and
 * wrapped as the store `Db` (bun:sqlite shares D1's query API, so repository code runs unchanged).
 * Migrations are discovered from `drizzle/` and sorted by their numeric prefix, so a newly generated
 * one is picked up automatically - no hand-kept list to drift out of sync with what the app ships.
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
  // bun:sqlite shares D1's query API but not its `.batch`, so overlay the same tx seam the app uses;
  // deferBatch then runs its statements in order (no real D1 batch), which is correct for tests.
  return transactionalDb(drizzle(sqlite, { schema }) as unknown as RawDb);
}
