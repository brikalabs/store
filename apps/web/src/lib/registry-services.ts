import { env } from "cloudflare:workers";
import { ManagementService, ScopeService } from "@brika/registry-core";
import { type Db, getDb } from "@brika/store-db";
import {
  D1AuditLog,
  D1CatalogReader,
  D1MetadataReader,
  D1MetadataWriter,
  D1OwnershipPolicy,
  D1ScopeMembers,
  D1ScopeStore,
  D1TokenStore,
} from "@brika/store-db/adapters";

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
  const ownership = new D1OwnershipPolicy(db, members);
  return {
    /** Scope use cases: create/claim, members + roles, display name. */
    scopes: new ScopeService(new D1ScopeStore(db), members),
    /** The members port directly, for the "scopes I belong to" read projection. */
    members,
    /** Post-publish management gated by scope membership: deprecate, yank. */
    management: new ManagementService(new D1MetadataWriter(db), ownership),
    /** Packument reader, for listing a package's versions with their flags. */
    metadata: new D1MetadataReader(db),
    /** Package catalog reader (`@brika/*` listing). */
    catalog: new D1CatalogReader(db),
    /** Publish-token store: issue/revoke for the account page. */
    tokens: new D1TokenStore(db),
    /** Append-only audit log of console mutations. */
    audit: new D1AuditLog(db),
  } as const;
}

export type RegistryServices = ReturnType<typeof registryServices>;
