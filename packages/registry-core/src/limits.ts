/**
 * Registry quotas and limits, the single source of truth shared by publish enforcement and
 * `docs/quotas-and-limits.md`. Per-field enforcement status is marked inline below: the count-based
 * quotas are not yet enforced (they need a usage-counting port), so treat those as docs for now.
 */

const MiB = 1024 * 1024;

export interface RegistryLimits {
  /** Max size of the gzipped tarball accepted by a single publish (bytes). */
  readonly maxTarballBytes: number;
  /** Max size of any single file inside a package version (bytes). */
  readonly maxFileBytes: number;
  /** Max total uncompressed size of a package version (bytes). */
  readonly maxUnpackedBytes: number;
  /** Max number of published versions a single package may hold. */
  readonly maxVersionsPerPackage: number;
  /** Max number of packages a single scope may contain. */
  readonly maxPackagesPerScope: number;
  /** Max number of scopes a single account may administer. */
  readonly maxScopesPerAccount: number;
  /** Package creations allowed per scope within the rolling window. */
  readonly weeklyPackageCreations: number;
  /** Publish attempts allowed per scope within the rolling window. */
  readonly weeklyPublishAttempts: number;
  /** Length in days of the rolling window the weekly limits apply over. */
  readonly weeklyWindowDays: number;
}

export const REGISTRY_LIMITS: RegistryLimits = {
  maxTarballBytes: 20 * MiB, // enforced (PublishService)
  maxFileBytes: 8 * MiB, // enforced (SchemaManifestValidator)
  maxUnpackedBytes: 40 * MiB, // enforced (SchemaManifestValidator)
  maxVersionsPerPackage: 1000, // @unenforced: needs a count port on the metadata store
  maxPackagesPerScope: 100, // @unenforced: needs a count port on the metadata store
  maxScopesPerAccount: 3, // enforced (ScopeService.claim, via ScopeMembers.countScopesAdminedBy)
  weeklyPackageCreations: 20, // @unenforced: needs a rolling-window count port
  weeklyPublishAttempts: 1000, // @unenforced: needs a rolling-window count port
  weeklyWindowDays: 7, // @unenforced: window for the weekly limits above
};
