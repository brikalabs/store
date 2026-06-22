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
 * Resolve the public account profile page data (USER-002) by account id (`users.id`), or null when
 * unknown (route 404s). Published plugins are derived by OWNERSHIP (account -> scope memberships ->
 * catalog plugins under those scopes), never npm; reviews are the social reviews the account authored.
 */
export async function resolveUserPage(id: string): Promise<UserPage | null> {
  const social = inject(SocialService);
  const profile = await social.getUserProfile(id);
  if (profile === null) return null;

  const [scopes, { plugins: catalog }, reviews] = await Promise.all([
    inject(ScopeMembershipStore).listScopesForMember(id),
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
