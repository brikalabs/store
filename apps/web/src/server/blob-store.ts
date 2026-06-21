import { inject } from "@brika/di";
import { Bindings } from "@/server/bindings";

/**
 * Object-storage port for the store's mirrored assets (extracted tarball files,
 * the file index). The store reads/writes blobs by key; it does not care whether
 * they live in Cloudflare R2, S3, or a local disk. An abstract class so it is both
 * the interface AND the DI token: a call site does `inject(BlobStore)` and the
 * injector resolves it to {@link CfR2BlobStore} (bound once in `webInjector`).
 * A different host is a new class extending this, with no change to the call sites.
 */
export abstract class BlobStore {
  /** Read an object's bytes by key, or null when it is absent. */
  abstract get(key: string): Promise<Uint8Array | null>;
  /** Write an object, optionally tagging its content type for direct serving. */
  abstract put(key: string, value: Uint8Array | string, contentType?: string): Promise<void>;
  /** Remove an object by key (idempotent). Compensates a staged put when a transaction rolls back. */
  abstract delete(key: string): Promise<void>;
}

/** Cloudflare R2 adapter for {@link BlobStore}. Reads its bucket from {@link Bindings}. */
export class CfR2BlobStore extends BlobStore {
  readonly #bucket = inject(Bindings).ASSETS;

  async get(key: string): Promise<Uint8Array | null> {
    const object = await this.#bucket.get(key);
    if (object === null) return null;
    return new Uint8Array(await object.arrayBuffer());
  }

  async put(key: string, value: Uint8Array | string, contentType?: string): Promise<void> {
    await this.#bucket.put(key, value, contentType ? { httpMetadata: { contentType } } : undefined);
  }

  async delete(key: string): Promise<void> {
    await this.#bucket.delete(key);
  }
}
