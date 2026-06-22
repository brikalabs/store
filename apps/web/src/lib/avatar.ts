import type { BlobStore } from "@/server/ports/blob-store";

/**
 * Avatar resolution (USER-002): an account's uploaded R2 image when set, else the provider image.
 * The public URL is built here from the blob store's current base, so a bucket/domain change never
 * leaves an absolute URL pointing at the wrong host.
 */

/** Upper bound for an uploaded avatar (the client resizes to ~512px WebP, so this is just a guard). */
export const MAX_AVATAR_BYTES = 512 * 1024; // 512 KiB

/** The R2 object key for an account's uploaded avatar (deterministic, one per account). */
export function userAvatarKey(userId: string): string {
  return `user-avatars/${userId}.webp`;
}

/** Resolve an account's avatar URL: the uploaded avatar (cache-busted by `?v=<version>`) when
 * `version` is non-null, else the provider image. Falls back to the provider image when the store
 * has no public base URL, so reads never break on misconfiguration. */
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
