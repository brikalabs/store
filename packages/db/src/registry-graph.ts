import { ManagementService, ScopeService } from "@brika/registry-core";
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
} from "./adapters";
import type { Db } from "./client";

/** Options for {@link buildRegistryGraph}. */
export interface RegistryGraphOptions {
  /** HMAC secret for scope-domain verification challenges (ORG-010). */
  readonly domainSecret: string;
}

/**
 * The D1-backed slice of the registry domain graph SHARED by both apps - the registry worker and
 * the store web app wire the same `brika-store` D1, so the adapter construction and the service
 * constructor arg lists live here once rather than copied into each app's composition root. Members
 * + trusted publishers feed the ownership policy, which is reused across scopes + management. Each
 * app provides these through its own `@brika/di` wrapper and adds its app-specific services (the
 * registry's R2-backed resolve/publish/device, the web's listings); a `@brika/registry-core`
 * constructor change is wired in this one place.
 */
export function buildRegistryGraph(db: Db, options: RegistryGraphOptions) {
  const scopeMembers = new D1ScopeMembers(db);
  const trustedPublishers = new D1TrustedPublishers(db);
  const ownership = new D1OwnershipPolicy(scopeMembers, trustedPublishers);
  return {
    scopeMembers,
    trustedPublishers,
    ownership,
    scopes: new ScopeService(new D1ScopeStore(db), scopeMembers, new D1ScopeDomains(db), {
      dnsResolver: new CloudflareDohResolver(),
      domainChallenge: new HmacDomainChallenge(options.domainSecret),
      trustedPublishers,
    }),
    management: new ManagementService(new D1MetadataWriter(db), ownership),
    metadata: new D1MetadataReader(db),
    catalog: new D1CatalogReader(db),
    tokens: new D1TokenStore(db),
    audit: new D1AuditLog(db),
  } as const;
}

/** The shared D1-backed registry graph, inferred from {@link buildRegistryGraph}. */
export type RegistryGraph = ReturnType<typeof buildRegistryGraph>;
