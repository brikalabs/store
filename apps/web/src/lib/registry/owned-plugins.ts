import type { PluginListingStatus, PluginSummary } from "@brika/registry-contract";
import { type MetadataReader, type PackageVersion, scopeOf } from "@brika/registry-core";
import { manifestToSummary } from "@/lib/registry/registry-mappers";
import { Manifest } from "@/lib/registry/registry-wire";

/** Sort published/deprecated (still live) ahead of the hidden states. */
const STATUS_RANK: Record<PluginListingStatus, number> = {
  published: 0,
  deprecated: 1,
  reserved: 2,
  yanked: 3,
  taken_down: 4,
};

// Latest installable version decides published vs deprecated; with none installable, an operator
// takedown reads as taken_down (owner can't restore), otherwise yanked (owner can un-yank).
function listingStatusOf(versions: readonly PackageVersion[]): PluginListingStatus {
  if (versions.length === 0) return "reserved";
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
  if (record === null) return null;
  // A reserved name: the row exists but nothing is published yet (no manifest to build from).
  if (record.versions.length === 0) return reservedSummary(name);
  const listingStatus = listingStatusOf(record.versions);
  const base = catalogByName.get(name) ?? buildSummary(record.versions, scopeName, name);
  return base === null ? null : { ...base, listingStatus };
}

/** A placeholder summary for a reserved (version-less) package, shown to its owner only. */
function reservedSummary(name: string): PluginSummary {
  return {
    name,
    displayName: name.split("/")[1] ?? name,
    version: "",
    brikaEngine: "",
    keywords: [],
    downloadsWeekly: 0,
    verified: false,
    featured: false,
    listingStatus: "reserved",
  };
}

/** Build a minimal summary from the newest installable version, falling back to the newest one. */
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

// ---------------------------------------------------------------------------
// My-plugins filter / aggregates (used by GET /api/plugins/mine). Live here, in
// the owned-plugins data layer, so the route file stays thin.
// ---------------------------------------------------------------------------

/** The status values the My-plugins filter accepts; `taken_down` is folded under "yanked". */
export const STATUSES = new Set(["published", "deprecated", "yanked"]);

export type OwnedFilters = { status: string; scope: string | null; query: string };

/** The grouping key a plugin is filtered/faceted under: its scope, or its bare name. */
const scopeKey = (plugin: PluginSummary): string => scopeOf(plugin.name) ?? plugin.name;

/** True when `plugin` passes all active filters. `yanked` also matches `taken_down`. */
export function matchesFilters(
  plugin: PluginSummary,
  { status, scope, query }: OwnedFilters,
): boolean {
  if (status !== "all") {
    const yanked = plugin.listingStatus === "yanked" || plugin.listingStatus === "taken_down";
    const match = status === "yanked" ? yanked : plugin.listingStatus === status;
    if (!match) return false;
  }
  if (scope && scope !== "all" && scopeKey(plugin) !== scope) return false;
  if (query !== "" && !`${plugin.displayName ?? ""} ${plugin.name}`.toLowerCase().includes(query)) {
    return false;
  }
  return true;
}

/** Overview-card aggregates computed over the full owned set. */
export function computeStats(all: PluginSummary[]) {
  const rated = all.filter((p) => p.rating);
  return {
    total: all.length,
    weeklyDownloads: all.reduce((sum, p) => sum + p.downloadsWeekly, 0),
    avgRating:
      rated.length > 0
        ? rated.reduce((sum, p) => sum + (p.rating?.average ?? 0), 0) / rated.length
        : 0,
    verified: all.filter((p) => p.verified).length,
  };
}

/** Filter-chip facet counts per scope, sorted by scope, named from `scopeName`. */
export function computeScopeFacets(all: PluginSummary[], scopeName: Map<string, string>) {
  const counts = new Map<string, number>();
  for (const plugin of all) {
    const scope = scopeKey(plugin);
    counts.set(scope, (counts.get(scope) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([scope, count]) => ({ scope, name: scopeName.get(scope) ?? scope, count }));
}
