import { inject } from "@brika/di";
import { badRequest } from "@brika/router";
import { avatarUrlOf, MAX_AVATAR_BYTES, userAvatarKey } from "@/lib/avatar";
import { sniffImageMime } from "@/lib/image-format";
import { BlobStore } from "@/server/ports/blob-store";
import { SocialService } from "@/server/services/social-service";

// A short content fingerprint, appended to the avatar URL to bust the CDN/browser cache on
// replacement (the R2 key is stable, so a new upload would otherwise reuse the URL).
async function contentTag(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).slice(0, 4), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Store an account's uploaded avatar (USER-002) and point the profile at its public R2 URL. Returns
 * the stored URL. Validates the FORMAT by the bytes' magic number, not the client-declared
 * `contentType`, so a mislabelled `image/webp` polyglot cannot be served as an image from the asset origin.
 */
export async function uploadUserAvatar(
  userId: string,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<string | undefined> {
  if (bytes.byteLength === 0) throw badRequest("Empty upload");
  if (bytes.byteLength > MAX_AVATAR_BYTES) throw badRequest("Avatar exceeds 512 KiB");
  if (sniffImageMime(bytes) !== "image/webp") throw badRequest("Avatar must be a WebP image");

  const assets = inject(BlobStore);
  await assets.put(userAvatarKey(userId), bytes, "image/webp");
  // Store only the content version; the public URL is derived from it at read time.
  const version = await contentTag(bytes);
  await inject(SocialService).setUserAvatar(userId, version);
  return avatarUrlOf(assets, version, userId, null);
}

/**
 * Clear an account's uploaded avatar and remove the R2 object, falling back to the provider image.
 * Returns the now-resolved avatar URL (the provider image, or undefined when there is none).
 */
export async function clearUserAvatar(userId: string): Promise<string | undefined> {
  const social = inject(SocialService);
  await social.setUserAvatar(userId, null);
  await inject(BlobStore).delete(userAvatarKey(userId));
  const profile = await social.getUserProfile(userId);
  return profile?.avatarUrl;
}
