/**
 * Registry quotas and limits: the single source of truth shared by the publish
 * enforcement (`PublishService`) and the documentation (`docs/quotas-and-limits.md`).
 *
 * Values are deliberately close to JSR's defaults, adapted to our hybrid model
 * (only the `@brika` scope is hosted today; community scopes open later) and to
 * Cloudflare's request/object realities. Quotas are not meant as hard ceilings:
 * a publisher who needs more can ask for an increase (see the docs).
 *
 * Enforcement status (kept honest on purpose):
 *   - ENFORCED: `maxTarballBytes` (`PublishService`), `maxFileBytes` +
 *     `maxUnpackedBytes` (the manifest gate, off the unpacked tarball),
 *     `maxOrgsPerAccount` (`OrgService.claim`, via `OrgMembers.countOrgsAdminedBy`).
 *   - NOT YET ENFORCED: the remaining count-based quotas below. They need a
 *     usage-counting port on the metadata store (versions/packages) or a
 *     rolling-window count (the weekly limits); until then, treat them as docs.
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
  /** Max number of orgs a single account may administer. */
  readonly maxOrgsPerAccount: number;
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
  maxOrgsPerAccount: 3, // enforced (OrgService.claim, via OrgMembers.countOrgsAdminedBy)
  weeklyPackageCreations: 20, // @unenforced: needs a rolling-window count port
  weeklyPublishAttempts: 1000, // @unenforced: needs a rolling-window count port
  weeklyWindowDays: 7, // @unenforced: window for the weekly limits above
};
