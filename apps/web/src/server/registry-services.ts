import { env } from "cloudflare:workers";
import { inject } from "@brika/di";
import { ManagementService, ScopeService } from "@brika/registry-core";
import { type Db, getDb } from "@brika/store-db";
import {
  CloudflareDohResolver,
  D1AuditLog,
  D1CatalogReader,
  D1MetadataReader,
  D1MetadataWriter,
  D1OwnershipPolicy,
  D1ScopeDomains,
  D1ScopeMembers,
  D1ScopeStore,
  D1TokenStore,
  D1TrustedPublishers,
  HmacDomainChallenge,
  listAllPackages,
} from "@brika/store-db/adapters";
import { Bindings } from "@/server/bindings";
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
  const members = new D1ScopeMembers(db);
  const trustedPublishers = new D1TrustedPublishers(db);
  const ownership = new D1OwnershipPolicy(members, trustedPublishers);
  return {
    /** Scope use cases: claim, members + roles, display name, profile, domains, publishers. */
    scopes: new ScopeService(new D1ScopeStore(db), members, new D1ScopeDomains(db), {
      dnsResolver: new CloudflareDohResolver(),
      domainChallenge: new HmacDomainChallenge(vars().DOMAIN_VERIFY_SECRET),
      trustedPublishers,
    }),
    /** The scope membership port directly, for the "scopes I belong to" read projection. */
    members,
    /** Post-publish management gated by scope membership: deprecate, yank. */
    management: new ManagementService(new D1MetadataWriter(db), ownership),
    /** Packument reader, for listing a package's versions with their flags. */
    metadata: new D1MetadataReader(db),
    /** Package catalog reader (`@brika/*` listing). */
    catalog: new D1CatalogReader(db),
    /** Publish-token store: issue/revoke for the account page. */
    tokens: new D1TokenStore(db),
    /** Audit log of console mutations: append (write) + recent (read, for the operator view). */
    audit: new D1AuditLog(db),
    /** Operator directory of every package with moderation counts (incl. hidden versions). */
    listPackages: () => listAllPackages(db),
  } as const;
}

export type RegistryServices = ReturnType<typeof registryServices>;

/**
 * Auto-building DI wrapper around the `reg_*` drizzle client. Mirrors {@link Database} (it
 * derives from {@link Bindings}, not the `cloudflare:workers` import, so it stays test-safe
 * and consistent), but is typed with the registry schema via `@brika/store-db`'s {@link getDb}.
 * A handler reaches the graph through {@link Registry}, not this directly.
 */
export class RegistryDatabase {
  readonly orm = getDb(inject(Bindings).DB);
}

/**
 * The web app's D1-backed registry service graph, wired over {@link RegistryDatabase}. A handler
 * reads `inject(Registry).graph`. `@brika/registry-core` stays a PURE package (no `@brika/di`):
 * the DI seam lives only in this `inject()` field, not in the graph wiring itself.
 */
export class Registry {
  readonly graph = registryServices(inject(RegistryDatabase).orm);
}
