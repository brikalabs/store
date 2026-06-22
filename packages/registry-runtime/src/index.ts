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
 * The registry domain wired for DI - the Angular/Nest "feature library". Every `@brika/registry-core`
 * service AND every `@brika/store-db` adapter is field-injectable (no constructors), so this package
 * is just a list of `{ provide: Port, useClass: Adapter }` bindings: an app spreads
 * {@link registryBindings} and provides the two runtime inputs ({@link RegistryDb}, {@link DomainSecret}).
 * The whole graph - `ScopeService` -> `ScopeStore` -> `D1ScopeStore` -> `Db` - then self-resolves; no
 * `new` anywhere.
 */

// The metadata read port (a handler `inject(MetadataReader).getPackage(...)`); the same token
// `ResolveService` injects, so there is one binding + one instance, not a handler/service split.
export { MetadataReader } from "@brika/registry-core";
// The two runtime-input tokens live in `@brika/store-db` (next to the `Db` type and the HMAC adapter
// that consume them); re-exported here under their app-facing names so a composition root provides
// `RegistryDb` / `DomainSecret` and `@brika/registry-core` stays pure.
export { Db as RegistryDb } from "@brika/store-db";
export { DomainSecret } from "@brika/store-db/adapters";

/**
 * Binds each registry-core PORT to its field-injected D1 adapter. Spread into an app's provider
 * list; the adapters resolve their own deps (`Db`, the sibling ports) from the active injector.
 */
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

// Handler-facing read ports, each a providedIn:'root' token whose factory builds the field-injected
// adapter in context (a handler `inject(Audit)` / ...; the adapter pulls `Db` itself). The metadata
// reader is NOT here - it is the shared `MetadataReader` port bound in registryBindings above.
export const Audit = token("Audit", () => new D1AuditLog());
export const Tokens = token("Tokens", () => new D1TokenStore());
export const Catalog = token("Catalog", () => new D1CatalogReader());

/** Operator package directory: every package with moderation counts (incl. hidden versions). */
export const Packages = token("Packages", () => {
  const db = inject(Db);
  return { list: () => listAllPackages(db) };
});
