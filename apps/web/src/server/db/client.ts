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
 * The store-schema drizzle client as an injectable: a store reads `inject(Database).orm`.
 * Plain class (no binding read here, so it stays test-safe); the composition root provides it
 * from the request's D1 (`useFactory: () => new Database(getDb(env.DB))`), and a unit test
 * overrides it with `{ provide: Database, useValue: { orm: inMemoryDb } }`.
 */
export class Database {
  constructor(readonly orm: Db) {}
}
