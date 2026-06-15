import { z } from "zod";

/**
 * A single published, immutable package version, as held by the metadata store.
 * The `manifest` is the published `package.json` for the version; the integrity
 * fields are computed once at publish time and never change.
 */
export const PackageVersion = z.object({
  name: z.string(),
  version: z.string(),
  /** The published `package.json` of this version (npm manifest). */
  manifest: z.record(z.string(), z.unknown()),
  /** Subresource Integrity, e.g. `sha512-...` (verified by bun on download). */
  integrity: z.string(),
  /** Legacy SHA-1 hex digest (`dist.shasum`). */
  shasum: z.string(),
  /** Tarball size in bytes. */
  size: z.number().int().nonnegative(),
  /** ISO-8601 publish timestamp. */
  publishedAt: z.iso.datetime(),
  /** Deprecation message; the version stays installable when deprecated. */
  deprecated: z.string().nullable().default(null),
  /** Yanked versions are hidden from new installs but kept for existing locks. */
  yanked: z.boolean().default(false),
});
export type PackageVersion = z.infer<typeof PackageVersion>;

/**
 * A package and all of its versions, as read from the metadata store. The
 * `distTags` map points named tags (e.g. `latest`) at concrete versions.
 */
export interface PackageRecord {
  readonly name: string;
  readonly distTags: Readonly<Record<string, string>>;
  readonly versions: readonly PackageVersion[];
  /** ISO-8601 timestamp of the first publish. */
  readonly createdAt: string;
}
