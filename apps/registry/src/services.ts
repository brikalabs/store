import { inject, type Provider, token } from "@brika/di";
import {
  DeviceService,
  type DownloadStore,
  OwnershipPolicy,
  PublishService,
  ResolveService,
} from "@brika/registry-core";
import { DomainSecret, Metadata, RegistryDb, registryBindings } from "@brika/registry-runtime";
import type { Db } from "@brika/store-db";
import {
  D1DeviceStore,
  D1DownloadStore,
  D1MetadataWriter,
  resolveActor,
} from "@brika/store-db/adapters";
import { SchemaManifestValidator } from "./adapters/manifest-validator";
import { NoopTarballScanner } from "./adapters/noop-tarball-scanner";
import { R2TarballReader } from "./adapters/r2-tarball";
import { R2TarballWriter } from "./adapters/r2-tarball-writer";

/** Operator admins (account ids) for takedown/restore. */
export const Admins = token<ReadonlySet<string>>();
/** Display-name resolver for the CLI's login/whoami (reads the web app's `users` table on the same D1). */
export const ResolveDisplayName = token<(userId: string) => Promise<string | null>>();
/** Download-counter store (registry-only). */
export const Downloads = token<DownloadStore>();

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
 * inputs (`RegistryDb`, `DomainSecret`) and alias the `@brika/registry-core` classes to its wired
 * tokens; `Audit`/`Catalog`/`Tokens` self-provide. This file adds only the registry's OWN services -
 * the R2-backed resolve/publish, the device flow, downloads, operator admins. A test passes a fake
 * db + bucket and appends a later provider.
 *
 * Rate limiting is intentionally NOT here: it is an inline edge concern on the routes that opt in.
 */
export function provideRegistry(config: RegistryConfig): Provider[] {
  const { db, tarballs, baseUrl } = config;

  return [
    { provide: RegistryDb, useValue: db },
    { provide: DomainSecret, useValue: config.domainSecret ?? "test-domain-secret" },
    { provide: Admins, useValue: config.admins ?? new Set() },
    {
      provide: ResolveDisplayName,
      useValue: (userId: string) => resolveActor(db, userId).then((a) => a.displayName),
    },
    // The registry domain: `ScopeService`/`ManagementService` self-resolve (field injection); these
    // bind the ports they inject to the D1 adapters.
    ...registryBindings,
    {
      provide: ResolveService,
      useFactory: () =>
        new ResolveService(inject(Metadata), new R2TarballReader(tarballs), { baseUrl }),
    },
    {
      provide: PublishService,
      useFactory: () =>
        new PublishService(
          new D1MetadataWriter(db),
          new R2TarballWriter(tarballs),
          new SchemaManifestValidator(),
          inject(OwnershipPolicy),
          { scanner: new NoopTarballScanner() },
        ),
    },
    { provide: DeviceService, useValue: new DeviceService(new D1DeviceStore(db)) },
    { provide: Downloads, useValue: new D1DownloadStore(db) },
  ];
}
