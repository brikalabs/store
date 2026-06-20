#!/usr/bin/env bun
/**
 * Apply the registry (`reg_*`) schema to the store's LOCAL dev D1.
 *
 * In production the store and registry share one D1, so it has both the store's social
 * tables and the registry's `reg_*` tables (each app's deploy migrates its own set into the
 * shared database). Locally, though, `vite dev` gives the store its own miniflare D1 and
 * only auto-applies the store's own migrations (`apps/web/drizzle`) - so the `reg_*` tables
 * the console now reads/writes (scopes, members, tokens, versions) are missing and every
 * authenticated console route 500s with "no such table: reg_*".
 *
 * This applies `packages/db/drizzle` (the `reg_*` migrations) to that local D1, idempotently
 * (it no-ops once `reg_scopes` exists). Run it once after `bun run dev` has created the D1,
 * and again after wiping `.wrangler/state`. Safe to re-run.
 */
import { Database } from "bun:sqlite";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const WEB_DIR = dirname(import.meta.dir); // apps/web
const D1_DIR = join(WEB_DIR, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const MIGRATIONS_DIR = join(WEB_DIR, "../../packages/db/drizzle");

function findLocalD1(): string | null {
  if (!existsSync(D1_DIR)) return null;
  const file = readdirSync(D1_DIR).find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  return file ? join(D1_DIR, file) : null;
}

const dbPath = findLocalD1();
if (dbPath === null) {
  console.error(
    "No local D1 found. Start the dev server once (`bun run dev`) to create it, then re-run this.",
  );
  process.exit(1);
}

const db = new Database(dbPath);
const hasReg = db
  .query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='reg_scopes'")
  .get();
if (hasReg !== null) {
  console.log("reg_* schema already present; nothing to do.");
  process.exit(0);
}

let applied = 0;
for (const file of readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  for (const statement of readFileSync(join(MIGRATIONS_DIR, file), "utf8").split(
    "--> statement-breakpoint",
  )) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) {
      db.run(trimmed);
      applied += 1;
    }
  }
}
console.log(`Applied ${applied} statements; reg_* schema is now in the local store D1.`);
