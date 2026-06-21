import { inject } from "@brika/di";
import { createClient } from "@brika/store-db";
import { Bindings } from "@/server/bindings";
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
 * Auto-building DI wrapper around the store-schema drizzle client: a store reads
 * `readonly #db = inject(Database).orm`. It self-resolves from {@link Bindings} (the one
 * value the composition root provides), so no token registration is needed; a unit test
 * overrides it with `{ provide: Database, useValue: { orm: inMemoryDb } }`.
 */
export class Database {
  readonly orm = getDb(inject(Bindings).DB);
}
