import {
  type PluginDetail,
  PluginDetail as PluginDetailSchema,
  type PluginSummary,
  PluginSummary as PluginSummarySchema,
  type PluginVersion,
  PluginVersion as PluginVersionSchema,
} from "@brika/registry-contract";
import {
  capabilityCounts,
  mapScreenshots,
  personName,
  repoUrl,
} from "@/lib/registry/manifest-mapping";
import { assetUrl } from "@/lib/registry/registry-paths";
import type { CatalogEntry, Manifest, Packument } from "@/lib/registry/registry-wire";

/**
 * Pure mappers from registry wire shapes into the `/v1` contract: a manifest to a plugin
 * summary/detail, a catalog page to summaries, and a packument to its release list. No network.
 */

export interface MapOptions {
  readonly publishedAt?: string;
  readonly updatedAt?: string;
  /** All-time installs from the registry's download stats. */
  readonly installs?: number;
  /** Trailing-week installs. */
  readonly downloadsWeekly?: number;
  /** SRI of the latest tarball (`sha512-...`). */
  readonly integrity?: string;
  readonly shasum?: string;
  /** The registry's verified publisher: the trusted "published by", overriding the manifest `author`. */
  readonly publisher?: { readonly id: string; readonly name: string; readonly verified: boolean };
}

/** Map a registry manifest to a `PluginDetail`; null when it is not a Brika plugin (no `engines.brika`). */
export function manifestToDetail(
  manifest: Manifest,
  options: MapOptions = {},
): PluginDetail | null {
  const brikaEngine = manifest.engines?.brika;
  if (brikaEngine === undefined) return null;
  const { name, version } = manifest;
  const authorName = personName(manifest.author);
  const candidate = {
    name,
    displayName: manifest.displayName,
    description: manifest.description,
    version,
    // Prefer the registry's verified publisher over the manifest `author`; fall back when unscoped.
    author:
      options.publisher ??
      (authorName === undefined
        ? undefined
        : { id: authorName, name: authorName, verified: false }),
    keywords: manifest.keywords ?? [],
    iconUrl: manifest.icon ? assetUrl(name, version, manifest.icon) : undefined,
    screenshots: mapScreenshots(manifest.screenshots, (path) => assetUrl(name, version, path)),
    downloadsWeekly: options.downloadsWeekly ?? 0,
    installs: options.installs,
    brikaEngine,
    repository: repoUrl(manifest.repository),
    homepage: manifest.homepage,
    license: manifest.license,
    capabilities: capabilityCounts(manifest),
    grants: manifest.grants ?? {},
    integrity: options.integrity ?? manifest.dist?.integrity,
    shasum: options.shasum ?? manifest.dist?.shasum,
    provenance: manifest.provenance,
    dependencies: manifest.dependencies,
    peerDependencies: manifest.peerDependencies,
    devDependencies: manifest.devDependencies,
    devDependencyCount: manifest.devDependencies
      ? Object.keys(manifest.devDependencies).length
      : undefined,
    size: manifest.dist?.size,
    unpackedSize: manifest.unpackedSize,
    fileCount: manifest.fileCount,
    tarballUrl: manifest.dist?.tarball,
    publishedAt: options.publishedAt,
    updatedAt: options.updatedAt,
  };
  const parsed = PluginDetailSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function manifestToSummary(
  manifest: Manifest,
  options: MapOptions = {},
): PluginSummary | null {
  const detail = manifestToDetail(manifest, options);
  return detail === null ? null : PluginSummarySchema.parse(detail);
}

/** Map registry catalog entries to plugin summaries, dropping any that are not Brika plugins. */
export function mapCatalogPackages(packages: CatalogEntry[]): PluginSummary[] {
  return packages.flatMap((entry) => {
    const summary = manifestToSummary(entry.manifest, {
      publishedAt: entry.createdAt,
      updatedAt: entry.publishedAt,
      installs: entry.downloads?.total,
      downloadsWeekly: entry.downloads?.weekly,
      publisher: entry.publisher,
    });
    return summary === null ? [] : [summary];
  });
}

function parseSemver(version: string): { nums: number[]; pre: string } {
  const dash = version.indexOf("-");
  const core = dash === -1 ? version : version.slice(0, dash);
  const pre = dash === -1 ? "" : version.slice(dash + 1);
  return { nums: core.split(".").map((n) => Number.parseInt(n, 10) || 0), pre };
}

/** Newest-first semver comparator (2.0.0 > 1.0.0 > 1.0.0-rc.1): orders by version, not publish
 * time, since versions published in the same second tie on the timestamp. */
export function compareVersionsDesc(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    const diff = (pb.nums[i] ?? 0) - (pa.nums[i] ?? 0);
    if (diff !== 0) return diff;
  }
  // A release outranks any prerelease of the same core version.
  if (pa.pre === "" && pb.pre !== "") return -1;
  if (pa.pre !== "" && pb.pre === "") return 1;
  return pb.pre.localeCompare(pa.pre);
}

/** Build the release list (newest first) from a registry packument. */
export function versionsFromPackument(pkg: Packument): PluginVersion[] {
  const versions = pkg.versions ?? {};
  const time = pkg.time ?? {};
  const list = Object.entries(versions).map(([version, manifest]) =>
    PluginVersionSchema.parse({
      version,
      publishedAt: time[version],
      brikaEngine: manifest.engines?.brika,
      deprecated: manifest.deprecated,
    }),
  );
  list.sort(
    (a, b) =>
      compareVersionsDesc(a.version, b.version) ||
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );
  return list;
}
