import type { PackageRecord, PackageVersion, ScopePublisher } from "./types";

/** The unscoped part of a package name: `@brika/plugin-x` -> `plugin-x`. */
export function unscopedName(name: string): string {
  const slash = name.lastIndexOf("/");
  return slash === -1 ? name : name.slice(slash + 1);
}

/** Trim trailing slashes from a base URL. A plain scan (no regex) so there's nothing to backtrack. */
export function trimTrailingSlash(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end--;
  return url.slice(0, end);
}

/**
 * Tarball path (npm convention `@brika/plugin-x/-/plugin-x-1.2.3.tgz`), also used as the R2 object
 * key so resolve and publish agree without a separate lookup.
 */
export function tarballPath(name: string, version: string): string {
  return `${name}/-/${unscopedName(name)}-${version}.tgz`;
}

/** Absolute tarball URL placed in the packument's `dist.tarball`. */
export function tarballUrl(baseUrl: string, name: string, version: string): string {
  return `${trimTrailingSlash(baseUrl)}/${tarballPath(name, version)}`;
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
  readonly takedowns?: Record<string, string>;
  readonly verified: boolean;
  readonly publisher?: ScopePublisher;
}

/** One version's full packument entry: its manifest plus the dist + management flags. */
function versionEntry(
  name: string,
  version: PackageVersion,
  baseUrl: string,
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    ...version.manifest,
    name,
    version: version.version,
    dist: {
      tarball: tarballUrl(baseUrl, name, version.version),
      integrity: version.integrity,
      shasum: version.shasum,
      size: version.size,
    },
  };
  if (version.deprecated !== null) entry.deprecated = version.deprecated;
  if (version.provenance !== null) entry.provenance = version.provenance;
  return entry;
}

/**
 * Build an npm-compatible packument from stored versions. Yanked and taken-down versions are omitted
 * (a taken-down version's reason is surfaced under `takedowns`); deprecated versions are included
 * with a `deprecated` field so bun warns but still installs them.
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
    versions[version.version] = versionEntry(record.name, version, baseUrl);
    time[version.version] = version.publishedAt;
    if (version.publishedAt > modified) modified = version.publishedAt;
  }

  return {
    name: record.name,
    "dist-tags": { ...record.distTags },
    versions,
    time: { ...time, modified },
    verified: record.verified,
    ...(Object.keys(takedowns).length > 0 ? { takedowns } : {}),
    ...(record.publisher ? { publisher: record.publisher } : {}),
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

/** One version's abbreviated entry: only the manifest fields bun needs to resolve + install. */
function abbreviatedEntry(
  name: string,
  version: PackageVersion,
  baseUrl: string,
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    name,
    version: version.version,
    dist: {
      tarball: tarballUrl(baseUrl, name, version.version),
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
  return entry;
}

/** Build the abbreviated install packument: only the fields bun needs, dropping readme/scripts/bulk. */
export function buildAbbreviatedPackument(
  record: PackageRecord,
  baseUrl: string,
): AbbreviatedPackument {
  const versions: Record<string, Record<string, unknown>> = {};
  let modified = record.createdAt;

  for (const version of record.versions) {
    if (version.yanked || version.takedownReason) continue;
    versions[version.version] = abbreviatedEntry(record.name, version, baseUrl);
    if (version.publishedAt > modified) modified = version.publishedAt;
  }

  return { name: record.name, "dist-tags": { ...record.distTags }, versions, modified };
}
