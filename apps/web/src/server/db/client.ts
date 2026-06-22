import { token } from "@brika/di";
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

/**
 * The store-schema drizzle client as an injectable: a store reads `inject(Database).orm`. A plain
 * token with no factory - it reads no binding, so this module stays free of `cloudflare:workers`
 * and unit-test-importable; the composition root (`injector.ts`) provides it from the D1 binding,
 * and a test overrides it with `{ provide: Database, useValue: { orm: inMemoryDb } }`.
 */
export interface Database {
  readonly orm: Db;
}
export const Database = token<Database>();
