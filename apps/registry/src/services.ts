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
/** Display-name resolver for the CLI's login/whoami (reads the web app's `users` table on the same D1). */
export const ResolveDisplayName =
  token<(userId: string) => Promise<string | null>>("ResolveDisplayName");
/** Download-counter store (registry-only). */
export const Downloads = token<DownloadStore>("Downloads");

// The shared registry domain tokens (Audit/Catalog/Tokens) come from the `@brika/registry-runtime`
// feature library; re-exported so controllers `inject(...)` them by the same names. They self-provide
// off `RegistryDb` (provided below).
export { Audit, Catalog, Tokens } from "@brika/registry-runtime";

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
 * shared `reg_*` domain services come from the `@brika/registry-runtime` library: provide its two
 * inputs (`RegistryDb`, `DomainSecret`) and spread its bindings; `Audit`/`Catalog`/`Tokens`
 * self-provide. This file binds only the registry's OWN service ports - the R2-backed resolve/publish
 * and the device flow - to their D1/R2 adapters. The services themselves (`ResolveService`,
 * `PublishService`, `DeviceService`) are field-injected `@brika/registry-core` classes, so they are
 * never `new`ed here: a controller `inject(ResolveService)` and the container builds it off these
 * ports. A test passes a fake db + bucket and appends a later provider.
 *
 * Rate limiting is intentionally NOT here: it is an inline edge concern on the routes that opt in.
 */
export function provideRegistry(config: RegistryConfig): Provider[] {
  const { db, tarballs, baseUrl } = config;

  return [
    // Runtime seams the field-injected adapters resolve from the active injector.
    { provide: RegistryDb, useValue: db },
    { provide: TarballBucket, useValue: tarballs },
    { provide: RegistryBaseUrl, useValue: baseUrl },
    { provide: DomainSecret, useValue: config.domainSecret ?? "test-domain-secret" },
    { provide: Admins, useValue: config.admins ?? new Set() },
    {
      provide: ResolveDisplayName,
      useValue: (userId: string) => resolveActor(db, userId).then((a) => a.displayName),
    },
    // The shared registry domain (Scope/Management ports -> D1 adapters).
    ...registryBindings,
    // The registry's OWN service ports -> their D1/R2 adapters. The scanner defaults to allow-all
    // in-core; the registry binds the explicit no-op so the seam is visible at the root. (MetadataReader
    // comes from registryBindings - the same read port the operator handlers inject.)
    { provide: TarballReader, useClass: R2TarballReader },
    { provide: MetadataWriter, useClass: D1MetadataWriter },
    { provide: TarballWriter, useClass: R2TarballWriter },
    { provide: ManifestValidator, useClass: SchemaManifestValidator },
    { provide: TarballScanner, useClass: NoopTarballScanner },
    { provide: DeviceStore, useClass: D1DeviceStore },
    { provide: Downloads, useClass: D1DownloadStore },
  ];
}
