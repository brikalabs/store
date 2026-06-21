import { inject } from "@brika/di";
import { scopeOf } from "@brika/registry-core";
import { searchPlugins } from "@/lib/registry/registry";
import type { UserPage } from "@/lib/registry/user-page";
import { SocialService } from "@/server/services/social-service";
import { ScopeMembershipStore } from "@/server/stores/scope-membership-store";

// Upper bound for the catalog scan when filtering to the account's owned scopes.
// Mirrors `getScopePage`: the hosted catalog is bounded, so one capped read covers it.
const CATALOG_SCAN = 200;

/**
 * Resolve the public account profile page data (USER-002) by the opaque account id (`users.id`).
 * Returns null for an unknown id so the route 404s. Server-side composition over the social service
 * + the scope-membership store, which is why it lives in `server/` (not the pure `lib/` read models).
 *
 * The published plugins are derived by OWNERSHIP, never npm: the account's GitHub login -> its scope
 * memberships -> the catalog plugins under those scopes (the same ownership filter `getScopePage`
 * applies). Reviews are the social reviews the account authored.
 */
export async function resolveUserPage(id: string): Promise<UserPage | null> {
  const social = inject(SocialService);
  const profile = await social.getUserProfile(id);
  if (profile === null) return null;

  const login = await social.findUserLogin(id);
  const [scopes, { plugins: catalog }, reviews] = await Promise.all([
    login ? inject(ScopeMembershipStore).listScopesForMember("github", login) : Promise.resolve([]),
    searchPlugins(undefined, CATALOG_SCAN, 0),
    social.listReviewsByUser(id),
  ]);
  const owned = new Set(scopes.map((s) => s.scope));
  const plugins = catalog.filter((plugin) => {
    const scope = scopeOf(plugin.name);
    return scope !== null && owned.has(scope);
  });

  return { profile, plugins, reviews };
}
