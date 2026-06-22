import { token } from "@brika/di";
import { createClient } from "@brika/store-db";
import * as schema from "./schema";

/** Build a typed Drizzle client around the request's D1 binding, scoped to the store/social tables. */
export function getDb(d1: D1Database) {
  return createClient(d1, schema);
}

export type Db = ReturnType<typeof getDb>;

/** The store-schema drizzle client as an injectable: a store reads `inject(Database)`. */
export const Database = token<Db>("Database");
