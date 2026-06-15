/**
 * Registry quotas and limits: the single source of truth shared by the publish
 * enforcement (`PublishService`) and the documentation (`docs/quotas-and-limits.md`).
 *
 * Values are deliberately close to JSR's defaults, adapted to our hybrid model
 * (only the `@brika` scope is hosted today; community scopes open later) and to
 * Cloudflare's request/object realities. Quotas are not meant as hard ceilings:
 * a publisher who needs more can ask for an increase (see the docs).
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
  /** Max number of scopes a single user may own. */
  readonly maxScopesPerUser: number;
  /** Package creations allowed per scope within the rolling window. */
  readonly weeklyPackageCreations: number;
  /** Publish attempts allowed per scope within the rolling window. */
  readonly weeklyPublishAttempts: number;
  /** Length in days of the rolling window the weekly limits apply over. */
  readonly weeklyWindowDays: number;
}

export const REGISTRY_LIMITS: RegistryLimits = {
  maxTarballBytes: 20 * MiB,
  maxFileBytes: 8 * MiB,
  maxUnpackedBytes: 40 * MiB,
  maxVersionsPerPackage: 1000,
  maxPackagesPerScope: 100,
  maxScopesPerUser: 3,
  weeklyPackageCreations: 20,
  weeklyPublishAttempts: 1000,
  weeklyWindowDays: 7,
};
