import type { TarballWriter } from "@brika/registry-core";

/** Writes immutable tarball objects to R2. */
export class R2TarballWriter implements TarballWriter {
  readonly #bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.#bucket = bucket;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    await this.#bucket.put(key, data);
  }
}
