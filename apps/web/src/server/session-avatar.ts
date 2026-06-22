import { inject } from "@brika/di";
import type { SessionUser } from "@/lib/auth/auth";
import { SocialService } from "@/server/services/social-service";

/**
 * Resolve a session user's avatar to its UPLOADED image when the account has one (else the provider
 * image stays), so the nav + sidebar match the public profile. The raw session only carries the
 * provider image.
 */
export async function withResolvedAvatar(user: SessionUser): Promise<SessionUser> {
  const profile = await inject(SocialService).getUserProfile(user.id);
  return { ...user, avatarUrl: profile?.avatarUrl ?? user.avatarUrl };
}
