import { type Provider, token } from "@brika/di";
import {
  type AuditLog,
  type CatalogReader,
  DeviceService,
  type DownloadStore,
  ManagementService,
  PublishService,
  ResolveService,
  ScopeService,
  type TokenStore,
} from "@brika/registry-core";
import type { Db } from "@brika/store-db";
import {
  CloudflareDohResolver,
  D1AuditLog,
  D1CatalogReader,
  D1DeviceStore,
  D1DownloadStore,
  D1MetadataReader,
  D1MetadataWriter,
  D1OwnershipPolicy,
  D1ScopeDomains,
  D1ScopeMembers,
  D1ScopeStore,
  D1TokenStore,
  D1TrustedPublishers,
  HmacDomainChallenge,
  resolveDisplayName,
} from "@brika/store-db/adapters";
import { SchemaManifestValidator } from "./adapters/manifest-validator";
import { NoopTarballScanner } from "./adapters/noop-tarball-scanner";
import { R2TarballReader } from "./adapters/r2-tarball";
import { R2TarballWriter } from "./adapters/r2-tarball-writer";

/** Operator admins (`provider:owner` keys) for takedown/restore. */
export const Admins = token<ReadonlySet<string>>();
/** Display-name resolver for the CLI's login/whoami (reads the web app's user tables on the same D1). */
export const ResolveDisplayName = token<(githubLogin: string) => Promise<string | null>>();
// Persistence ports as tokens, so a handler depends on the registry-core interface, not the D1 class.
export const Tokens = token<TokenStore>();
export const Catalog = token<CatalogReader>();
export const Downloads = token<DownloadStore>();
export const Audit = token<AuditLog>();

/** The runtime values the platform hands the registry per request (or a test supplies). */
export interface RegistryConfig {
  readonly db: Db;
  readonly tarballs: R2Bucket;
  readonly baseUrl: string;
  readonly admins?: ReadonlySet<string>;
  readonly domainSecret?: string;
}

/**
 * The registry's composition root as `@brika/di` providers (Angular's `provideX()` shape). Builds
 * the graph once from `config` - the shared adapters (`scopeMembers`, `ownership`) as locals reused
 * across services, as a hand-rolled factory would - and binds each result under its token, so a
 * handler `inject(ScopeService)` / `inject(Tokens)` and the rest is already wired. Domain services
 * bind under their own class; persistence adapters bind under their PORT token (the registry-core
 * interface), keeping controllers off the concrete `D1*` and the ORM. A test passes a fake db +
 * bucket and appends a later provider to override one binding.
 *
 * Rate limiting is intentionally NOT here: it is an inline edge concern on the routes that opt in.
 */
export function provideRegistry(config: RegistryConfig): Provider[] {
  const { db, tarballs, baseUrl } = config;
  // The scope IS the ownership entity: membership + trusted-publisher bindings, shared by the
  // publish/management authorization policy and the scope service.
  const scopeMembers = new D1ScopeMembers(db);
  const trustedPublishers = new D1TrustedPublishers(db);
  const ownership = new D1OwnershipPolicy(scopeMembers, trustedPublishers);

  return [
    { provide: Admins, useValue: config.admins ?? new Set() },
    { provide: ResolveDisplayName, useValue: (login: string) => resolveDisplayName(db, login) },
    {
      provide: ResolveService,
      useValue: new ResolveService(new D1MetadataReader(db), new R2TarballReader(tarballs), {
        baseUrl,
      }),
    },
    {
      provide: PublishService,
      useValue: new PublishService(
        new D1MetadataWriter(db),
        new R2TarballWriter(tarballs),
        new SchemaManifestValidator(),
        ownership,
        { scanner: new NoopTarballScanner() },
      ),
    },
    {
      provide: ManagementService,
      useValue: new ManagementService(new D1MetadataWriter(db), ownership),
    },
    {
      provide: ScopeService,
      useValue: new ScopeService(new D1ScopeStore(db), scopeMembers, new D1ScopeDomains(db), {
        dnsResolver: new CloudflareDohResolver(),
        domainChallenge: new HmacDomainChallenge(config.domainSecret ?? "test-domain-secret"),
        trustedPublishers,
      }),
    },
    { provide: DeviceService, useValue: new DeviceService(new D1DeviceStore(db)) },
    { provide: Catalog, useValue: new D1CatalogReader(db) },
    { provide: Tokens, useValue: new D1TokenStore(db) },
    { provide: Downloads, useValue: new D1DownloadStore(db) },
    { provide: Audit, useValue: new D1AuditLog(db) },
  ];
}
