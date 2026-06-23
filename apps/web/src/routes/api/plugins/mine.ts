import { inject } from "@brika/di";
import { PageQuery, type PluginSummary } from "@brika/registry-contract";
import { paginate, scopeOf } from "@brika/registry-core";
import { MetadataReader } from "@brika/registry-runtime";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import {
  computeScopeFacets,
  computeStats,
  matchesFilters,
  resolveOwnedPlugins,
  STATUSES,
} from "@/lib/registry/owned-plugins";
import { searchPlugins } from "@/lib/registry/registry";
import { runAuthed } from "@/server/http";
import { ScopeMembershipStore } from "@/server/stores/scope-membership-store";

/**
 * `GET /api/plugins/mine?q=&status=&scope=&limit=&offset=` - the plugins published under a scope
 * the signed-in user owns, each tagged with its `PluginListingStatus`. Unlike the public catalog
 * this includes version-less / fully-hidden packages so the owner can relist them. The scope set is
 * resolved server-side from the session, so the client can never widen what it sees.
 *
 * Returns a **page**, plus aggregates over the full owned set (`stats` for the overview cards,
 * `scopes` facet counts for the filter chips), so the client never fetches everything. The filter +
 * aggregate logic lives in `lib/registry/owned-plugins`.
 */
export const Route = createFileRoute("/api/plugins/mine")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runAuthed(request, async (a) => {
          const url = new URL(request.url);
          const window = PageQuery.parse({
            limit: url.searchParams.get("limit") ?? undefined,
            offset: url.searchParams.get("offset") ?? undefined,
          });
          const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
          const statusParam = url.searchParams.get("status") ?? "all";
          const status = STATUSES.has(statusParam) ? statusParam : "all";
          const scope = url.searchParams.get("scope");

          const membership = inject(ScopeMembershipStore);
          const [myScopes, catalog] = await Promise.all([
            membership.listScopesForMember(a.user.id),
            searchPlugins(undefined, 200, 0),
          ]);
          const owned = new Set(myScopes.map((s) => s.scope));
          const scopeName = new Map(myScopes.map((s) => [s.scope, s.displayName ?? s.scope]));

          const catalogByName = new Map<string, PluginSummary>();
          for (const plugin of catalog.plugins) {
            const s = scopeOf(plugin.name);
            if (s !== null && owned.has(s) && !catalogByName.has(plugin.name)) {
              catalogByName.set(plugin.name, plugin);
            }
          }

          const ownedNames = await membership.listPackageNamesForScopes([...owned]);
          const all = (
            await resolveOwnedPlugins(inject(MetadataReader), ownedNames, scopeName, catalogByName)
          ).sort((x, y) => (y.updatedAt ?? "").localeCompare(x.updatedAt ?? ""));

          const filtered = all.filter((p) => matchesFilters(p, { status, scope, query }));
          return reply({
            page: paginate(filtered, window),
            scopes: computeScopeFacets(all, scopeName),
            stats: computeStats(all),
          });
        }),
    },
  },
});
