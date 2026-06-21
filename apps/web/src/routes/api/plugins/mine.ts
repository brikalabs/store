import type { PluginListingStatus, PluginSummary } from "@brika/registry-contract";
import { type MetadataReader, type PackageVersion, scopeOf } from "@brika/registry-core";
import { reply } from "@brika/router";
import { listPackageNamesForScopes, listScopesForMember } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { searchPlugins } from "@/lib/registry/registry";
import { Manifest, manifestToSummary } from "@/lib/registry/registry-source";
import { authed, runHandler } from "@/server/http";
import { registryDb } from "@/server/registry-services";

/**
 * `GET /api/plugins/mine` - every plugin published under a scope the signed-in user owns (scope
 * membership, so real Brika ownership, never an npm maintainer guess), each tagged with its
 * {@link PluginListingStatus}. Unlike the public catalog this includes packages with no
 * installable version (every version yanked / taken down): they would otherwise vanish from the
 * owner's view with no way to relist them. Listed packages reuse the rich catalog summary;
 * hidden ones are rebuilt from their newest version's manifest. Returns `{ plugins }`.
 *
 * The scope set is resolved server-side from the session user via {@link listScopesForMember}
 * (the same ownership read `api/plugins/versions` gates management on), so the client can never
 * widen what it sees.
 */
export const Route = createFileRoute("/api/plugins/mine")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runHandler(async () => {
          const a = await authed(request);

          // The scopes the user owns, the hosted catalog (rich summaries for listed packages),
          // and every owned package name (incl. unlisted ones). The first three reads are
          // independent, so overlap them; the catalog is bounded, so one capped scan covers it.
          const [myScopes, catalog] = await Promise.all([
            listScopesForMember(registryDb(), "github", a.user.login),
            searchPlugins(undefined, 200, 0),
          ]);
          const owned = new Set(myScopes.map((s) => s.scope));
          const scopeName = new Map(myScopes.map((s) => [s.scope, s.displayName ?? s.scope]));

          const catalogByName = new Map<string, PluginSummary>();
          for (const plugin of catalog.plugins) {
            const scope = scopeOf(plugin.name);
            if (scope !== null && owned.has(scope) && !catalogByName.has(plugin.name)) {
              catalogByName.set(plugin.name, plugin);
            }
          }

          const ownedNames = await listPackageNamesForScopes(registryDb(), [...owned]);
          const resolved = await Promise.all(
            ownedNames.map((name) =>
              resolveOwnedPlugin(a.svc.metadata, scopeName, catalogByName, name),
            ),
          );
          const plugins = resolved
            .filter((p): p is PluginSummary => p !== null)
            .sort(
              (a, b) =>
                STATUS_RANK[a.listingStatus] - STATUS_RANK[b.listingStatus] ||
                (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name),
            );

          return reply({ plugins });
        }),
    },
  },
});

/** Sort published/deprecated (still live) ahead of the hidden states. */
const STATUS_RANK: Record<PluginListingStatus, number> = {
  published: 0,
  deprecated: 1,
  yanked: 2,
  taken_down: 3,
};

/**
 * Project a package's per-version flags to a package-level status: its latest installable
 * version decides `published` vs `deprecated`; with none installable, an operator takedown
 * reads as `taken_down` (owner can't restore) and otherwise `yanked` (owner can un-yank).
 */
function listingStatusOf(versions: readonly PackageVersion[]): PluginListingStatus {
  const latest = newestVersion(versions.filter((v) => !v.yanked && v.takedownReason === null));
  if (latest !== undefined) return latest.deprecated === null ? "published" : "deprecated";
  return versions.some((v) => v.takedownReason !== null) ? "taken_down" : "yanked";
}

/** The version published most recently, or undefined for an empty list. */
function newestVersion(versions: readonly PackageVersion[]): PackageVersion | undefined {
  return versions.reduce<PackageVersion | undefined>(
    (a, b) => (a === undefined || b.publishedAt > a.publishedAt ? b : a),
    undefined,
  );
}

/**
 * The summary + status for one owned package. Listed packages reuse the rich catalog summary;
 * hidden ones are rebuilt from their newest version's manifest so they still appear (flagged).
 * Returns null if the package or a usable manifest is gone, so one bad row never drops the list.
 */
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
