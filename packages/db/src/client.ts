import { token } from "@brika/di";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Build a Drizzle client typed to `appSchema`'s tables. The single place the D1 driver is imported,
 * so moving off D1 (e.g. to Postgres) is a one-file change rather than a repo-wide sweep.
 */
export function createClient<TSchema extends Record<string, unknown>>(
  binding: D1Database,
  appSchema: TSchema,
) {
  return drizzle(binding, { schema: appSchema });
}

/** Typed Drizzle client over the registry's `reg_*` tables (this package). */
export function getDb(d1: D1Database) {
  return createClient(d1, schema);
}

export type Db = ReturnType<typeof getDb>;

/** DI token for the reg_* drizzle client - the one dependency every D1 adapter field-injects. */
export const Db = token<Db>("Db");
