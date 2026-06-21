/**
 * Avatar resolution, the counterpart to `display-name`: an account's avatar is its UPLOADED image
 * (the public URL of an object in R2, USER-002) when it has one, otherwise the provider (GitHub)
 * image - the default. Pure, so it lives in `lib` and is shared by every store that projects a user
 * (reviews, comments, profile).
 */

/** Upper bound for an uploaded avatar (the client resizes to ~512px WebP, so this is just a guard). */
export const MAX_AVATAR_BYTES = 512 * 1024; // 512 KiB

/** The R2 object key for an account's uploaded avatar. Deterministic (one per account, overwritten
 *  on re-upload). The object is served by its public URL, not the worker. */
export function userAvatarKey(userId: string): string {
  return `user-avatars/${userId}.webp`;
}

/**
 * Resolve the avatar shown for an account: its uploaded avatar's public URL when set, else the
 * provider image, else none. `uploadedUrl` is `user_profiles.avatar_url` (non-null means uploaded).
 */
export function avatarUrlOf(
  uploadedUrl: string | null,
  providerImage: string | null,
): string | undefined {
  return uploadedUrl ?? providerImage ?? undefined;
}
