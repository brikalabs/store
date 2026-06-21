import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";

/**
 * A real in-memory SQLite over the store/social schema, built from the same drizzle migrations
 * the app ships, wrapped as the store `Db`. The store's `Db` is a D1 client; bun:sqlite exposes
 * the same query API, so the repository code runs unchanged here. Shared by every store/service
 * test so the schema setup lives in one place.
 */

const MIGRATIONS_DIR = join(import.meta.dir, "../../../drizzle");
const MIGRATIONS = ["0000_parched_sauron.sql", "0001_betterauth.sql", "0002_user_profiles.sql"];

export function makeStoreDb(): Db {
  const sqlite = new Database(":memory:");
  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed.length > 0) sqlite.run(trimmed);
    }
  }
  return drizzle(sqlite, { schema }) as unknown as Db;
}
