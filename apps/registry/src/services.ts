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
import { buildRegistryGraph, type Db } from "@brika/store-db";
import {
  D1DeviceStore,
  D1DownloadStore,
  D1MetadataWriter,
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
 * The registry's composition root as `@brika/di` providers (Angular's `provideX()` shape). The
 * shared D1-backed services come from `buildRegistryGraph` (one place wires the adapters + service
 * constructors for both apps); this adds the registry's own R2-backed resolve/publish, the device
 * flow, downloads, and operator admins. Domain services bind under their own class; persistence
 * ports bind under their PORT token (the registry-core interface), keeping controllers off the
 * concrete `D1*` and the ORM. A test passes a fake db + bucket and appends a later provider.
 *
 * Rate limiting is intentionally NOT here: it is an inline edge concern on the routes that opt in.
 */
export function provideRegistry(config: RegistryConfig): Provider[] {
  const { db, tarballs, baseUrl } = config;
  const g = buildRegistryGraph(db, { domainSecret: config.domainSecret ?? "test-domain-secret" });

  return [
    { provide: Admins, useValue: config.admins ?? new Set() },
    { provide: ResolveDisplayName, useValue: (login: string) => resolveDisplayName(db, login) },
    {
      provide: ResolveService,
      useValue: new ResolveService(g.metadata, new R2TarballReader(tarballs), { baseUrl }),
    },
    {
      provide: PublishService,
      useValue: new PublishService(
        new D1MetadataWriter(db),
        new R2TarballWriter(tarballs),
        new SchemaManifestValidator(),
        g.ownership,
        { scanner: new NoopTarballScanner() },
      ),
    },
    { provide: ManagementService, useValue: g.management },
    { provide: ScopeService, useValue: g.scopes },
    { provide: DeviceService, useValue: new DeviceService(new D1DeviceStore(db)) },
    { provide: Catalog, useValue: g.catalog },
    { provide: Tokens, useValue: g.tokens },
    { provide: Downloads, useValue: new D1DownloadStore(db) },
    { provide: Audit, useValue: g.audit },
  ];
}
