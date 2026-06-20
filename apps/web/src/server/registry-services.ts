import { env } from "cloudflare:workers";
import { ManagementService, OrgService } from "@brika/registry-core";
import { type Db, getDb } from "@brika/store-db";
import {
  CloudflareDohResolver,
  D1AuditLog,
  D1CatalogReader,
  D1MetadataReader,
  D1MetadataWriter,
  D1OrgDomains,
  D1OrgMembers,
  D1OrgScopes,
  D1OrgStore,
  D1OwnershipPolicy,
  D1TokenStore,
  HmacDomainChallenge,
} from "@brika/store-db/adapters";
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
  const members = new D1OrgMembers(db);
  const orgScopes = new D1OrgScopes(db);
  const ownership = new D1OwnershipPolicy(members, orgScopes);
  return {
    /** Org use cases: claim, members + roles, display name, profile, scopes, domains. */
    orgs: new OrgService(new D1OrgStore(db), members, orgScopes, new D1OrgDomains(db), {
      dnsResolver: new CloudflareDohResolver(),
      domainChallenge: new HmacDomainChallenge(vars().DOMAIN_VERIFY_SECRET),
    }),
    /** The org membership port directly, for the "orgs I belong to" read projection. */
    members,
    /** Post-publish management gated by org membership: deprecate, yank. */
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
