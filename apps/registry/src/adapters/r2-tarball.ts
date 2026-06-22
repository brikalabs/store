import { inject, token } from "@brika/di";
import type { TarballReader } from "@brika/registry-core";

/** The R2 bucket holding published tarballs. */
export const TarballBucket = token<R2Bucket>("TarballBucket");

/** Streams immutable tarball objects from R2. */
export class R2TarballReader implements TarballReader {
  readonly #bucket = inject(TarballBucket);

  async get(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const object = await this.#bucket.get(key);
    return object === null ? null : object.body;
  }
}
