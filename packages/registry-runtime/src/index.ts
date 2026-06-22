import { InjectionToken, inject, type Provider } from "@brika/di";
import {
  DnsResolver,
  DomainChallenge,
  OwnershipPolicy,
  ScopeDomains,
  ScopeMembers,
  ScopeStore,
  TrustedPublishers,
  VersionManager,
} from "@brika/registry-core";
import type { Db } from "@brika/store-db";
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

/**
 * The registry domain wired for DI - the Angular/Nest "feature library". The `@brika/registry-core`
 * services are field-injectable (no constructors); this package binds each PORT token they inject to
 * its `@brika/store-db` D1 adapter, so an app just spreads {@link registryBindings} and provides the
 * two runtime inputs ({@link RegistryDb}, {@link DomainSecret}). `ScopeService`/`ManagementService`
 * then auto-resolve - no `new Service(...)` anywhere. `@brika/registry-core` stays pure.
 */

/** The reg_* drizzle client. Each app provides it from its binding (web `env.DB`, registry `config.db`). */
export const RegistryDb = new InjectionToken<Db>({ description: "RegistryDb" });

/** HMAC secret for scope-domain verification challenges (ORG-010). Each app provides it. */
export const DomainSecret = new InjectionToken<string>({ description: "DomainSecret" });

/**
 * Binds each registry-core PORT to its D1 adapter. Spread into an app's provider list; the
 * field-injected services (`ScopeService`, `ManagementService`) resolve their ports from here.
 */
export const registryBindings: Provider[] = [
  { provide: ScopeStore, useFactory: () => new D1ScopeStore(inject(RegistryDb)) },
  { provide: ScopeMembers, useFactory: () => new D1ScopeMembers(inject(RegistryDb)) },
  { provide: ScopeDomains, useFactory: () => new D1ScopeDomains(inject(RegistryDb)) },
  { provide: TrustedPublishers, useFactory: () => new D1TrustedPublishers(inject(RegistryDb)) },
  { provide: DnsResolver, useFactory: () => new CloudflareDohResolver() },
  { provide: DomainChallenge, useFactory: () => new HmacDomainChallenge(inject(DomainSecret)) },
  { provide: VersionManager, useFactory: () => new D1MetadataWriter(inject(RegistryDb)) },
  {
    provide: OwnershipPolicy,
    useFactory: () => new D1OwnershipPolicy(inject(ScopeMembers), inject(TrustedPublishers)),
  },
];

// Handler-facing read ports, each over the injected reg DB (a handler `inject(Audit)` / ...).
export const Audit = new InjectionToken({
  description: "Audit",
  factory: () => new D1AuditLog(inject(RegistryDb)),
});
export const Metadata = new InjectionToken({
  description: "Metadata",
  factory: () => new D1MetadataReader(inject(RegistryDb)),
});
export const Tokens = new InjectionToken({
  description: "Tokens",
  factory: () => new D1TokenStore(inject(RegistryDb)),
});
export const Catalog = new InjectionToken({
  description: "Catalog",
  factory: () => new D1CatalogReader(inject(RegistryDb)),
});

/** Operator package directory: every package with moderation counts (incl. hidden versions). */
export const Packages = new InjectionToken({
  description: "Packages",
  factory: () => {
    const db = inject(RegistryDb);
    return { list: () => listAllPackages(db) };
  },
});
