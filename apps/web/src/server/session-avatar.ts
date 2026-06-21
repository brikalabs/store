import { inject, isInInjectionContext, runInContext } from "@brika/di";
import type { SessionUser } from "@/lib/auth/auth";
import { webProviders } from "@/server/injector";
import { SocialService } from "@/server/services/social-service";

/**
 * Resolve a session user's avatar to its UPLOADED image when the account has one (else the provider
 * image stays), so the nav + dashboard sidebar show the same avatar as the public profile, reviews,
 * and comments. The raw session only carries the provider image, so this reads the profile to apply
 * the same `avatarUrlOf` resolution the stores use.
 *
 * Resolves against the ALREADY-ACTIVE injection context when there is one (so it shares the
 * request's db/blob singletons), and only stands up its own context when called standalone (e.g.
 * the `fetchSessionUser` server function) - never a second composition root nested inside a first.
 */
export async function withResolvedAvatar(user: SessionUser): Promise<SessionUser> {
  const resolve = async () => {
    const profile = await inject(SocialService).getUserProfile(user.id);
    return profile?.avatarUrl ?? user.avatarUrl;
  };
  const avatarUrl = isInInjectionContext()
    ? await resolve()
    : await runInContext(webProviders, resolve);
  return { ...user, avatarUrl };
}
