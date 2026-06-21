import type { BlobObject, BlobStore } from "@/server/ports/blob-store";

/**
 * Cloudflare R2 adapter for the {@link BlobStore} port (the integration layer). The composition
 * root passes the request's bucket (`env.ASSETS`); nothing else in the app touches R2 directly.
 */
export class CfR2BlobStore implements BlobStore {
  readonly #bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.#bucket = bucket;
  }

  async get(key: string): Promise<BlobObject | null> {
    const object = await this.#bucket.get(key);
    if (object === null) return null;
    // R2's object already has size + body + httpMetadata; expose them as the port shape, with
    // `bytes()` buffering the same body for callers that parse rather than stream.
    return {
      size: object.size,
      contentType: object.httpMetadata?.contentType,
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
