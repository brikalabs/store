import type { TarballWriter } from "@brika/registry-core";
import { onRollback } from "@brika/tx";

/** Writes immutable tarball objects to R2. */
export class R2TarballWriter implements TarballWriter {
  readonly #bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.#bucket = bucket;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    await this.#bucket.put(key, data);
    // Inside a transaction, a publish whose metadata commit fails rolls the tarball
    // back; outside one, this is a no-op.
    onRollback(() => this.delete(key));
  }

  async delete(key: string): Promise<void> {
    await this.#bucket.delete(key);
  }
}
