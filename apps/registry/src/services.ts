import { type Provider, token } from "@brika/di";
import {
  DeviceStore,
  type DownloadStore,
  ManifestValidator,
  MetadataWriter,
  RegistryBaseUrl,
  TarballReader,
  TarballScanner,
  TarballWriter,
} from "@brika/registry-core";
import { DomainSecret, RegistryDb, registryBindings } from "@brika/registry-runtime";
import type { Db } from "@brika/store-db";
import {
  D1DeviceStore,
  D1DownloadStore,
  D1MetadataWriter,
  resolveActor,
} from "@brika/store-db/adapters";
import { SchemaManifestValidator } from "./adapters/manifest-validator";
import { NoopTarballScanner } from "./adapters/noop-tarball-scanner";
import { R2TarballReader, TarballBucket } from "./adapters/r2-tarball";
import { R2TarballWriter } from "./adapters/r2-tarball-writer";

/** Operator admins (account ids) for takedown/restore. */
export const Admins = token<ReadonlySet<string>>("Admins");
/** Display-name resolver for the CLI's login/whoami. */
export const ResolveDisplayName =
  token<(userId: string) => Promise<string | null>>("ResolveDisplayName");
/** Download-counter store (registry-only). */
export const Downloads = token<DownloadStore>("Downloads");

export { Audit, Catalog, Search, Tokens } from "@brika/registry-runtime";

/** The runtime values the platform hands the registry per request (or a test supplies). */
export interface RegistryConfig {
  readonly db: Db;
  readonly tarballs: R2Bucket;
  readonly baseUrl: string;
  readonly admins?: ReadonlySet<string>;
  readonly domainSecret?: string;
}

/**
 * The registry's composition root as `@brika/di` providers. Binds the registry's own ports
 * (R2-backed resolve/publish, device flow) to their D1/R2 adapters and spreads the shared
 * `@brika/registry-runtime` bindings. Rate limiting is deliberately NOT here: it is an inline
 * edge concern on the routes that opt in.
 */
export function provideRegistry(config: RegistryConfig): Provider[] {
  const { db, tarballs, baseUrl } = config;

  return [
    { provide: RegistryDb, useValue: db },
    { provide: TarballBucket, useValue: tarballs },
    { provide: RegistryBaseUrl, useValue: baseUrl },
    { provide: DomainSecret, useValue: config.domainSecret ?? "test-domain-secret" },
    { provide: Admins, useValue: config.admins ?? new Set() },
    {
      provide: ResolveDisplayName,
      useValue: (userId: string) => resolveActor(db, userId).then((a) => a.displayName),
    },
    ...registryBindings,
    // The registry's own ports -> their D1/R2 adapters.
    { provide: TarballReader, useClass: R2TarballReader },
    { provide: MetadataWriter, useClass: D1MetadataWriter },
    { provide: TarballWriter, useClass: R2TarballWriter },
    { provide: ManifestValidator, useClass: SchemaManifestValidator },
    { provide: TarballScanner, useClass: NoopTarballScanner },
    { provide: DeviceStore, useClass: D1DeviceStore },
    { provide: Downloads, useClass: D1DownloadStore },
  ];
}
