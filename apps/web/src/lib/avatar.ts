import type { BlobStore } from "@/server/ports/blob-store";

/**
 * Avatar resolution, the counterpart to `display-name`: an account's avatar is its UPLOADED image
 * (an object in R2, served by its public URL, USER-002) when it has one, otherwise the provider
 * (GitHub) image - the default. The public URL is BUILT here from the blob store's current base, so
 * a bucket/domain change (or a stale row) never leaves an absolute URL pointing at the wrong host.
 */

/** Upper bound for an uploaded avatar (the client resizes to ~512px WebP, so this is just a guard). */
export const MAX_AVATAR_BYTES = 512 * 1024; // 512 KiB

/** The R2 object key for an account's uploaded avatar. Deterministic (one per account, overwritten
 *  on re-upload). The object is served by its public URL, not the worker. */
export function userAvatarKey(userId: string): string {
  return `user-avatars/${userId}.webp`;
}

/**
 * Resolve the avatar shown for an account: its uploaded avatar's public URL when set (built from the
 * current base + a cache-busting `?v=<version>`), else the provider image, else none. `version` is
 * `user_profiles.avatar_version`: non-null means the account uploaded one. Falls back to the provider
 * image if the store has no public base URL configured (so reads never break on misconfiguration).
 */
export function avatarUrlOf(
  blobs: Pick<BlobStore, "url">,
  version: string | null,
  userId: string,
  providerImage: string | null,
): string | undefined {
  if (version !== null) {
    const base = blobs.url(userAvatarKey(userId));
    if (base !== undefined) return `${base}?v=${version}`;
  }
  return providerImage ?? undefined;
}
