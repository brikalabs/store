import type { BlobObject, BlobStore } from "@/server/ports/blob-store";

/**
 * Cloudflare R2 adapter for the {@link BlobStore} port (the integration layer). The composition
 * root passes the request's bucket (`env.ASSETS`) and the bucket's public base URL (its CDN custom
 * domain, `ASSETS_PUBLIC_URL`); nothing else in the app touches R2 directly.
 */
export class CfR2BlobStore implements BlobStore {
  readonly #bucket: R2Bucket;
  readonly #publicBaseUrl: string | undefined;

  constructor(bucket: R2Bucket, publicBaseUrl: string | undefined) {
    this.#bucket = bucket;
    this.#publicBaseUrl = publicBaseUrl?.replace(/\/+$/, "");
  }

  url(key: string): string {
    if (this.#publicBaseUrl === undefined) {
      throw new Error(
        "ASSETS_PUBLIC_URL is not set: enable public access on the bucket and set it to the r2.dev URL.",
      );
    }
    return `${this.#publicBaseUrl}/${key}`;
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
