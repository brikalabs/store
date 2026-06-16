import { createClient } from "@brika/store-db";
import * as schema from "./schema";

/**
 * Build a typed Drizzle client around the request's D1 binding, scoped to the
 * store/social tables. The Cloudflare D1 driver itself lives in `@brika/store-db`
 * (`createClient`) so the eventual move off D1 is a one-file change there.
 */
export function getDb(d1: D1Database) {
  return createClient(d1, schema);
}

export type Db = ReturnType<typeof getDb>;
