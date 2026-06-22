import { inject } from "@brika/di";
import type { SessionUser } from "@/lib/auth/auth";
import { SocialService } from "@/server/services/social-service";

/**
 * Resolve a session user's avatar to its UPLOADED image when the account has one (else the provider
 * image stays), so the nav + dashboard sidebar show the same avatar as the public profile, reviews,
 * and comments. The raw session only carries the provider image, so this reads the profile to apply
 * the same `avatarUrlOf` resolution the stores use. Runs in the app's injection context (the global
 * request middleware), so it just `inject(SocialService)`.
 */
export async function withResolvedAvatar(user: SessionUser): Promise<SessionUser> {
  const profile = await inject(SocialService).getUserProfile(user.id);
  return { ...user, avatarUrl: profile?.avatarUrl ?? user.avatarUrl };
}
