import type { PluginListingStatus, PluginSummary } from "@brika/registry-contract";
import { type MetadataReader, type PackageVersion, scopeOf } from "@brika/registry-core";
import { Manifest, manifestToSummary } from "@/lib/registry/registry-source";

/** Sort published/deprecated (still live) ahead of the hidden states. */
const STATUS_RANK: Record<PluginListingStatus, number> = {
  published: 0,
  deprecated: 1,
  yanked: 2,
  taken_down: 3,
};

// Latest installable version decides published vs deprecated; with none installable, an operator
// takedown reads as taken_down (owner can't restore), otherwise yanked (owner can un-yank).
function listingStatusOf(versions: readonly PackageVersion[]): PluginListingStatus {
  const latest = newestVersion(versions.filter((v) => !v.yanked && v.takedownReason === null));
  if (latest !== undefined) return latest.deprecated === null ? "published" : "deprecated";
  return versions.some((v) => v.takedownReason !== null) ? "taken_down" : "yanked";
}

function newestVersion(versions: readonly PackageVersion[]): PackageVersion | undefined {
  return versions.reduce<PackageVersion | undefined>(
    (a, b) => (a === undefined || b.publishedAt > a.publishedAt ? b : a),
    undefined,
  );
}

// Listed packages reuse the rich catalog summary; hidden ones are rebuilt from their newest
// manifest so they still appear. Null on a gone package/manifest, so one bad row never drops the list.
async function resolveOwnedPlugin(
  metadata: MetadataReader,
  scopeName: Map<string, string>,
  catalogByName: Map<string, PluginSummary>,
  name: string,
): Promise<PluginSummary | null> {
  const record = await metadata.getPackage(name);
  if (record === null || record.versions.length === 0) return null;
  const listingStatus = listingStatusOf(record.versions);
  const base = catalogByName.get(name) ?? buildSummary(record.versions, scopeName, name);
  return base === null ? null : { ...base, listingStatus };
}

function buildSummary(
  versions: readonly PackageVersion[],
  scopeName: Map<string, string>,
  name: string,
): PluginSummary | null {
  const installable = versions.filter((v) => !v.yanked && v.takedownReason === null);
  const newest = newestVersion(installable) ?? newestVersion(versions);
  if (newest === undefined) return null;
  const manifest = Manifest.safeParse(newest.manifest);
  if (!manifest.success) return null;
  const scope = scopeOf(name);
  return manifestToSummary(manifest.data, {
    publisher:
      scope === null
        ? undefined
        : { id: scope, name: scopeName.get(scope) ?? scope, verified: true },
  });
}

/** Resolve owned package names into {@link PluginSummary}s tagged with listing status, sorted live-states-first then by name. */
export async function resolveOwnedPlugins(
  metadata: MetadataReader,
  ownedNames: readonly string[],
  scopeName: Map<string, string>,
  catalogByName: Map<string, PluginSummary>,
): Promise<PluginSummary[]> {
  const resolved = await Promise.all(
    ownedNames.map((name) => resolveOwnedPlugin(metadata, scopeName, catalogByName, name)),
  );
  return resolved
    .filter((p): p is PluginSummary => p !== null)
    .sort(
      (a, b) =>
        STATUS_RANK[a.listingStatus] - STATUS_RANK[b.listingStatus] ||
        (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name),
    );
}
