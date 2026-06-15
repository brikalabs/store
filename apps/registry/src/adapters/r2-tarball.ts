import type { TarballReader } from "@brika/registry-core";

/** Streams immutable tarball objects from R2. */
export class R2TarballReader implements TarballReader {
  readonly #bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.#bucket = bucket;
  }

  async get(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const object = await this.#bucket.get(key);
    return object === null ? null : object.body;
  }
}
