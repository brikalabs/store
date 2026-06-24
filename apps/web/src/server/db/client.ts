import { token } from "@brika/di";
import { createClient } from "@brika/store-db";
import { transactionalDb } from "@brika/tx";
import * as schema from "./schema";

/** The raw store client (a drizzle D1 client over the social schema), exposed so the test harness can overlay it too. */
export type RawDb = ReturnType<typeof createClient<typeof schema>>;

/** Build the transaction-aware store client around the request's D1 binding (the composition root binds this). */
export function getDb(d1: D1Database) {
  return transactionalDb(createClient(d1, schema));
}

/**
 * The store client, made transaction-aware by `@brika/tx` (inferred from {@link getDb}, so it cannot
 * drift): `deferBatch` lands as one atomic D1 batch at the unit's commit point (rolling back with the
 * saga), and any write inside a `readOnlyTransaction` throws. A store reads `inject(Db)`.
 */
export type Db = ReturnType<typeof getDb>;

/** DI token for the store drizzle client. Name matches the type, per the token-naming rule (di.md). */
export const Db = token<Db>("Db");
