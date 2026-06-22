import { inject } from "@brika/di";
import type { PluginSummary } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { MetadataReader } from "@brika/registry-runtime";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { resolveOwnedPlugins } from "@/lib/registry/owned-plugins";
import { searchPlugins } from "@/lib/registry/registry";
import { runAuthed } from "@/server/http";
import { ScopeMembershipStore } from "@/server/stores/scope-membership-store";

/**
 * `GET /api/plugins/mine` - every plugin under a scope the signed-in user owns, each tagged with its
 * `PluginListingStatus`. Unlike the public catalog this includes packages with no installable version
 * (every version yanked / taken down), which would otherwise vanish with no way to relist them. The
 * scope set is resolved server-side from the session user, so the client can never widen what it sees.
 */
export const Route = createFileRoute("/api/plugins/mine")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runAuthed(request, async (a) => {
          // Independent reads, overlapped; the catalog is bounded, so one capped scan covers it.
          const membership = inject(ScopeMembershipStore);
          const [myScopes, catalog] = await Promise.all([
            membership.listScopesForMember(a.user.id),
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
            inject(MetadataReader),
            ownedNames,
            scopeName,
            catalogByName,
          );

          return reply({ plugins });
        }),
    },
  },
});
