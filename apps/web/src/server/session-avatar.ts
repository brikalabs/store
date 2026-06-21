import { inject, runInContext } from "@brika/di";
import type { SessionUser } from "@/lib/auth/auth";
import { webProviders } from "@/server/injector";
import { SocialService } from "@/server/services/social-service";

/**
 * Resolve a session user's avatar to its UPLOADED image when the account has one (else the provider
 * image stays), so the nav + dashboard sidebar show the same avatar as the public profile, reviews,
 * and comments. The raw session only carries the provider image, so this reads the profile (in a
 * per-request injection context) to apply the same `avatarUrlOf` resolution the stores use.
 */
export async function withResolvedAvatar(user: SessionUser): Promise<SessionUser> {
  const avatarUrl = await runInContext(webProviders, async () => {
    const profile = await inject(SocialService).getUserProfile(user.id);
    return profile?.avatarUrl ?? user.avatarUrl;
  });
  return { ...user, avatarUrl };
}
