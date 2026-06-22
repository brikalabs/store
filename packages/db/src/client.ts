import { token } from "@brika/di";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * The single place the Cloudflare D1 Drizzle driver is imported. Both the
 * registry and the store build their client through here, each passing its own
 * schema, so the returned client is typed to that app's own tables. Centralising
 * the driver means moving off D1 (e.g. to Postgres via `drizzle-orm/node-postgres`)
 * is a one-file change rather than a repo-wide sweep.
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

/**
 * DI token for the reg_* drizzle client - the one dependency every D1 adapter field-injects
 * (`readonly #db = inject(Db)`). Each app provides it from its binding (web `env.DB`, registry
 * `config.db`); `@brika/registry-runtime` re-exports it as `RegistryDb`. Lives here, with the
 * `Db` type, so the adapters in this package can inject it without a cross-package cycle.
 */
export const Db = token<Db>("Db");
