import { inject, token } from "@brika/di";
import { joinUrl } from "@/lib/url";
import type { BlobObject, BlobStore } from "@/server/ports/blob-store";

/** The R2 bucket holding the web's mirrored assets + icons (`env.ASSETS`); the app provides it. */
export const AssetsBucket = token<R2Bucket>("AssetsBucket");
/** The assets bucket's public CDN base URL (`ASSETS_PUBLIC_URL`), or undefined when unconfigured. */
export const AssetsPublicUrl = token<string | undefined>("AssetsPublicUrl");

/**
 * Cloudflare R2 adapter for the {@link BlobStore} port (the integration layer). Field-injects the
 * request's bucket ({@link AssetsBucket}) and the bucket's public base URL ({@link AssetsPublicUrl},
 * its CDN custom domain); nothing else in the app touches R2 directly.
 */
export class CfR2BlobStore implements BlobStore {
  readonly #bucket = inject(AssetsBucket);
  readonly #publicBaseUrl = inject(AssetsPublicUrl);

  url(key: string): string | undefined {
    return this.#publicBaseUrl === undefined ? undefined : joinUrl(this.#publicBaseUrl, key);
  }

  async get(key: string): Promise<BlobObject | null> {
    const object = await this.#bucket.get(key);
    if (object === null) return null;
    // R2's object already has size + body + httpMetadata; expose them as the port shape, with
    // `bytes()` buffering the same body for callers that parse rather than stream.
    return {
      size: object.size,
      contentType: object.httpMetadata?.contentType,
      // R2's ETag, pre-quoted for the header (and echoed back in If-None-Match).
      etag: object.httpEtag,
      body: object.body,
      bytes: async () => new Uint8Array(await object.arrayBuffer()),
    };
  }

  async put(key: string, value: Uint8Array | string, contentType?: string): Promise<void> {
    await this.#bucket.put(key, value, contentType ? { httpMetadata: { contentType } } : undefined);
  }

  async delete(key: string): Promise<void> {
    await this.#bucket.delete(key);
  }
}
