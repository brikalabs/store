/**
 * Object-storage port for the store's mirrored assets (extracted tarball files,
 * the file index). The store reads/writes blobs by key; it does not care whether
 * they live in Cloudflare R2, S3, or a local disk. `CfR2BlobStore` is the only
 * adapter today; a different host is a new class implementing this interface, with
 * no change to the call sites (which receive a `BlobStore` from `serverContext`).
 */
export interface BlobStore {
  /** Read an object's bytes by key, or null when it is absent. */
  get(key: string): Promise<Uint8Array | null>;
  /** Write an object, optionally tagging its content type for direct serving. */
  put(key: string, value: Uint8Array | string, contentType?: string): Promise<void>;
}

/** Cloudflare R2 adapter for {@link BlobStore}. */
export class CfR2BlobStore implements BlobStore {
  readonly #bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.#bucket = bucket;
  }

  async get(key: string): Promise<Uint8Array | null> {
    const object = await this.#bucket.get(key);
    if (object === null) return null;
    return new Uint8Array(await object.arrayBuffer());
  }

  async put(key: string, value: Uint8Array | string, contentType?: string): Promise<void> {
    await this.#bucket.put(key, value, contentType ? { httpMetadata: { contentType } } : undefined);
  }
}
