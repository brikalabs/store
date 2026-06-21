import { env } from "cloudflare:workers";
import { inject, type Provider, token } from "@brika/di";
import { ManagementService, ScopeService } from "@brika/registry-core";
import { buildRegistryGraph, type Db, getDb } from "@brika/store-db";
import { listAllPackages } from "@brika/store-db/adapters";
import { vars } from "@/server/env";

/**
 * The web app's registry composition root - the D1-backed subset of the registry's own
 * service graph, wired against the SHARED `brika-store` D1 (the store and registry bind
 * the same database as `DB`). Console server handlers reuse the registry domain directly
 * instead of calling the registry over HTTP, authorizing with the session user mapped to
 * a `PublishIdentity` (see `sessionIdentity`).
 *
 * SERVER-ONLY: this imports `cloudflare:workers` + drizzle, so it must be referenced only
 * from route `server` handlers / `beforeLoad` / loaders, never a client component.
 */

/** Drizzle client typed with the `reg_*` schema over the shared D1 binding. */
export function registryDb(): Db {
  return getDb(env.DB);
}

export function registryServices(db: Db = registryDb()) {
  // The D1-backed registry graph SHARED with the registry worker (`@brika/store-db`), plus the one
  // web-only read projection (listPackages). `members` exposes the membership port for the
  // "scopes I belong to" read; the console reuses the registry domain in-process, not over HTTP.
  const g = buildRegistryGraph(db, { domainSecret: vars().DOMAIN_VERIFY_SECRET });
  return {
    scopes: g.scopes,
    members: g.scopeMembers,
    management: g.management,
    metadata: g.metadata,
    catalog: g.catalog,
    tokens: g.tokens,
    audit: g.audit,
    /** Operator directory of every package with moderation counts (incl. hidden versions). */
    listPackages: () => listAllPackages(db),
  } as const;
}

export type RegistryServices = ReturnType<typeof registryServices>;

/**
 * The `reg_*` drizzle client as an injectable. Mirrors {@link Database} but typed with the
 * registry schema via `@brika/store-db`'s {@link getDb}. Plain class (test-safe); the
 * composition root provides it from the request's D1. A handler reaches the graph through
 * {@link Registry}, not this directly.
 */
export class RegistryDatabase {
  constructor(readonly orm: Db) {}
}

/**
 * The reg_* graph, built once per request and shared (di memoizes it). Internal: a handler injects
 * the individual services below, never this whole graph.
 */
const Graph = token<RegistryServices>();

// The registry services as individual DI tokens, so a handler `inject(ScopeService)` /
// `inject(Audit)` exactly what it needs. `scopes`/`management` ARE the `@brika/registry-core`
// classes (import them from there); the rest are value tokens over the graph members.
export const Audit = token<RegistryServices["audit"]>();
export const Metadata = token<RegistryServices["metadata"]>();
export const Tokens = token<RegistryServices["tokens"]>();
export const ListPackages = token<RegistryServices["listPackages"]>();

/**
 * Providers for the reg_* graph: build it once (from {@link RegistryDatabase}), then expose each
 * member under its token. `injector.ts` spreads these into `webProviders`. `@brika/registry-core`
 * stays PURE (no `@brika/di`): the DI seam lives only in these factories, not in the graph wiring.
 */
export const registryProviders: Provider[] = [
  { provide: Graph, useFactory: () => registryServices(inject(RegistryDatabase).orm) },
  { provide: ScopeService, useFactory: () => inject(Graph).scopes },
  { provide: ManagementService, useFactory: () => inject(Graph).management },
  { provide: Audit, useFactory: () => inject(Graph).audit },
  { provide: Metadata, useFactory: () => inject(Graph).metadata },
  { provide: Tokens, useFactory: () => inject(Graph).tokens },
  { provide: ListPackages, useFactory: () => inject(Graph).listPackages },
];
