import { inject } from "@brika/di";
import type { TarballWriter } from "@brika/registry-core";
import { onRollback } from "@brika/tx";
import { TarballBucket } from "./r2-tarball";

/** Writes immutable tarball objects to R2. */
export class R2TarballWriter implements TarballWriter {
  readonly #bucket = inject(TarballBucket);

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
