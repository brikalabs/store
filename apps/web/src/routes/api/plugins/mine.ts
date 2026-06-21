import { inject } from "@brika/di";
import type { PluginSummary } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { resolveOwnedPlugins } from "@/lib/registry/owned-plugins";
import { searchPlugins } from "@/lib/registry/registry";
import { runAuthed } from "@/server/http";
import { Metadata } from "@/server/registry-services";
import { ScopeMembershipStore } from "@/server/stores/scope-membership-store";

/**
 * `GET /api/plugins/mine` - every plugin published under a scope the signed-in user owns (scope
 * membership, so real Brika ownership, never an npm maintainer guess), each tagged with its
 * `PluginListingStatus`. Unlike the public catalog this includes packages with no installable
 * version (every version yanked / taken down): they would otherwise vanish from the owner's view
 * with no way to relist them. Listed packages reuse the rich catalog summary; hidden ones are
 * rebuilt from their newest version's manifest. Returns `{ plugins }`.
 *
 * The scope set is resolved server-side from the session user via {@link listScopesForMember}
 * (the same ownership read `api/plugins/versions` gates management on), so the client can never
 * widen what it sees.
 */
export const Route = createFileRoute("/api/plugins/mine")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runAuthed(request, async (a) => {
          // The scopes the user owns and the hosted catalog (rich summaries for listed packages).
          // These reads are independent, so overlap them; the catalog is bounded, so one capped
          // scan covers it.
          const membership = inject(ScopeMembershipStore);
          const [myScopes, catalog] = await Promise.all([
            membership.listScopesForMember("github", a.user.login),
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

          const ownedNames = await membership.listPackageNamesForScopes([...owned]);
          const plugins = await resolveOwnedPlugins(
            inject(Metadata),
            ownedNames,
            scopeName,
            catalogByName,
          );

          return reply({ plugins });
        }),
    },
  },
});
