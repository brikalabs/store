import type { PackageRecord } from "./types";

/** The unscoped part of a package name: `@brika/plugin-x` -> `plugin-x`. */
export function unscopedName(name: string): string {
  const slash = name.lastIndexOf("/");
  return slash === -1 ? name : name.slice(slash + 1);
}

/**
 * Tarball path relative to the registry root, following npm's convention:
 * `@brika/plugin-x/-/plugin-x-1.2.3.tgz`. Also used as the R2 object key so the
 * resolve and publish paths agree without a separate lookup.
 */
export function tarballPath(name: string, version: string): string {
  return `${name}/-/${unscopedName(name)}-${version}.tgz`;
}

/** Absolute tarball URL placed in the packument's `dist.tarball`. */
export function tarballUrl(baseUrl: string, name: string, version: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${tarballPath(name, version)}`;
}

export interface PackumentDist {
  readonly tarball: string;
  readonly integrity: string;
  readonly shasum: string;
  /** Packed (gzipped) tarball size in bytes. */
  readonly size?: number;
}

/** An npm-compatible packument (the document `bun add` resolves against). */
export interface Packument {
  readonly name: string;
  readonly "dist-tags": Record<string, string>;
  readonly versions: Record<string, Record<string, unknown>>;
  readonly time: Record<string, string>;
  /**
   * Versions removed by an operator takedown, mapped to their public reason. A
   * non-standard field (npm clients ignore it) the storefront reads to show why a
   * version is gone; the versions themselves are absent from `versions` above.
   */
  readonly takedowns?: Record<string, string>;
  /**
   * The verified publisher (the scope owner + its chosen display name). Non-standard
   * field the storefront renders as the trusted "published by", overriding the
   * free-text manifest `author`. Absent for unclaimed/unscoped packages.
   */
  readonly publisher?: { readonly id: string; readonly name: string; readonly verified: true };
}

/**
 * Build an npm-compatible packument from stored versions. Yanked AND taken-down
 * versions are omitted (hidden from new installs); a taken-down version's reason is
 * surfaced under `takedowns`. Deprecated versions are included with a `deprecated`
 * field so bun surfaces the warning but still installs them.
 */
export function buildPackument(record: PackageRecord, baseUrl: string): Packument {
  const versions: Record<string, Record<string, unknown>> = {};
  const takedowns: Record<string, string> = {};
  const time: Record<string, string> = { created: record.createdAt };
  let modified = record.createdAt;

  for (const version of record.versions) {
    if (version.takedownReason) {
      takedowns[version.version] = version.takedownReason;
      continue;
    }
    if (version.yanked) continue;

    const dist: PackumentDist = {
      tarball: tarballUrl(baseUrl, record.name, version.version),
      integrity: version.integrity,
      shasum: version.shasum,
      size: version.size,
    };
    const entry: Record<string, unknown> = {
      ...version.manifest,
      name: record.name,
      version: version.version,
      dist,
    };
    if (version.deprecated !== null) entry.deprecated = version.deprecated;
    if (version.provenance !== null) entry.provenance = version.provenance;

    versions[version.version] = entry;
    time[version.version] = version.publishedAt;
    if (version.publishedAt > modified) modified = version.publishedAt;
  }

  return {
    name: record.name,
    "dist-tags": { ...record.distTags },
    versions,
    time: { ...time, modified },
    ...(Object.keys(takedowns).length > 0 ? { takedowns } : {}),
    ...(record.publisher
      ? { publisher: { id: record.publisher.id, name: record.publisher.name, verified: true } }
      : {}),
  };
}

/** Abbreviated install metadata (`application/vnd.npm.install-v1+json`). */
export interface AbbreviatedPackument {
  readonly name: string;
  readonly "dist-tags": Record<string, string>;
  readonly versions: Record<string, Record<string, unknown>>;
  readonly modified: string;
}

// Only the manifest fields bun needs to resolve and install a dependency.
const ABBREVIATED_KEYS = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
  "bundleDependencies",
  "bundledDependencies",
  "acceptDependencies",
  "bin",
  "directories",
  "engines",
  "os",
  "cpu",
  "libc",
  "funding",
  "_hasShrinkwrap",
];

function hasInstallScript(manifest: Record<string, unknown>): boolean {
  const scripts = manifest.scripts;
  if (scripts === null || typeof scripts !== "object") return false;
  return ["install", "preinstall", "postinstall"].some((name) => name in scripts);
}

/**
 * Build the abbreviated install packument: only the fields bun needs to resolve
 * and install, dropping readme, scripts, and other manifest bulk. Much smaller
 * for packages with many versions.
 */
export function buildAbbreviatedPackument(
  record: PackageRecord,
  baseUrl: string,
): AbbreviatedPackument {
  const versions: Record<string, Record<string, unknown>> = {};
  let modified = record.createdAt;

  for (const version of record.versions) {
    if (version.yanked || version.takedownReason) continue;

    const entry: Record<string, unknown> = {
      name: record.name,
      version: version.version,
      dist: {
        tarball: tarballUrl(baseUrl, record.name, version.version),
        integrity: version.integrity,
        shasum: version.shasum,
      },
    };
    for (const key of ABBREVIATED_KEYS) {
      const value = version.manifest[key];
      if (value !== undefined) entry[key] = value;
    }
    if (hasInstallScript(version.manifest)) entry.hasInstallScript = true;
    if (version.deprecated !== null) entry.deprecated = version.deprecated;

    versions[version.version] = entry;
    if (version.publishedAt > modified) modified = version.publishedAt;
  }

  return { name: record.name, "dist-tags": { ...record.distTags }, versions, modified };
}
