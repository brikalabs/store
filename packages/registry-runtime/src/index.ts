import { inject, type Provider, token } from "@brika/di";
import {
  DnsResolver,
  DomainChallenge,
  MetadataReader,
  OwnershipPolicy,
  ScopeDomains,
  ScopeMembers,
  ScopeStore,
  TrustedPublishers,
  VersionManager,
} from "@brika/registry-core";
import { Db } from "@brika/store-db";
import {
  CloudflareDohResolver,
  D1AuditLog,
  D1CatalogReader,
  D1DownloadStore,
  D1MetadataReader,
  D1MetadataWriter,
  D1OwnershipPolicy,
  D1ScopeDomains,
  D1ScopeMembers,
  D1ScopeStore,
  D1SearchReader,
  D1TokenStore,
  D1TrustedPublishers,
  HmacDomainChallenge,
  listAllPackages,
} from "@brika/store-db/adapters";

/**
 * The registry domain wired for DI: each `@brika/registry-core` port bound to its `@brika/store-db`
 * adapter. An app spreads {@link registryBindings} and provides the two runtime inputs
 * ({@link RegistryDb}, {@link DomainSecret}); the whole graph then self-resolves.
 */

export { MetadataReader } from "@brika/registry-core";
export { Db as RegistryDb } from "@brika/store-db";
export { DomainSecret } from "@brika/store-db/adapters";

/** Binds each registry-core PORT to its field-injected D1 adapter; spread into an app's provider list. */
export const registryBindings: Provider[] = [
  { provide: ScopeStore, useClass: D1ScopeStore },
  { provide: ScopeMembers, useClass: D1ScopeMembers },
  { provide: ScopeDomains, useClass: D1ScopeDomains },
  { provide: TrustedPublishers, useClass: D1TrustedPublishers },
  { provide: DnsResolver, useClass: CloudflareDohResolver },
  { provide: DomainChallenge, useClass: HmacDomainChallenge },
  { provide: MetadataReader, useClass: D1MetadataReader },
  { provide: VersionManager, useClass: D1MetadataWriter },
  { provide: OwnershipPolicy, useClass: D1OwnershipPolicy },
];

// Handler-facing read ports (the metadata reader is the shared `MetadataReader` bound above, not here).
export const Audit = token("Audit", () => new D1AuditLog());
export const Tokens = token("Tokens", () => new D1TokenStore());
export const Catalog = token("Catalog", () => new D1CatalogReader());
/** Catalog search (FTS + tag/capability filter, sort, pagination), pushed down to SQL. */
export const Search = token("Search", () => new D1SearchReader());
/** Install counts (all-time + trailing week), keyed by package name. */
export const Downloads = token("Downloads", () => new D1DownloadStore());

/** Operator package directory: every package with moderation counts (incl. hidden versions). */
export const Packages = token("Packages", () => {
  const db = inject(Db);
  return {
    list: (opts: { q?: string; limit: number; offset: number }) => listAllPackages(db, opts),
  };
});
