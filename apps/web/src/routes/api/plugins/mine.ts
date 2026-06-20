import { scopeOf } from "@brika/registry-core";
import { listScopesForMember } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { searchPlugins } from "@/lib/registry/registry";
import { authed, runJson } from "@/server/console-api";
import { registryDb } from "@/server/registry-services";

/**
 * `GET /api/plugins/mine` - the catalog plugins published under scopes the signed-in user
 * owns: the npm scopes attached to any org they are a member of (publishing is gated on org
 * membership, so this is real Brika ownership, never an npm maintainer guess). The store no
 * longer lists from public npm, so "my plugins" is sourced from the hosted catalog filtered
 * by the user's scope set. Returns `{ plugins }` ({@link PluginSummary}[]), deduped by name.
 *
 * The scope set is resolved server-side from the session user via {@link listScopesForMember}
 * (the same ownership read `api/plugins/versions` gates management on), so the client can
 * never widen what it sees.
 */
export const Route = createFileRoute("/api/plugins/mine")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runJson(async () => {
          const a = await authed(request);

          // The npm scopes the user owns (via org membership), and the hosted catalog. Both
          // round-trips are independent, so overlap them; the catalog is bounded, so one
          // capped scan covers every scope.
          const [myScopes, catalog] = await Promise.all([
            listScopesForMember(registryDb(), "github", a.user.login),
            searchPlugins(undefined, 200, 0),
          ]);

          const owned = new Set(myScopes.map((s) => s.scope));
          const seen = new Set<string>();
          const plugins = catalog.plugins.filter((plugin) => {
            const scope = scopeOf(plugin.name);
            if (scope === null || !owned.has(scope) || seen.has(plugin.name)) return false;
            seen.add(plugin.name);
            return true;
          });

          return jsonPrivate({ plugins });
        }),
    },
  },
});
