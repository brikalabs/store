import type { TarballScanner } from "@brika/registry-core";

/** Allow-all {@link TarballScanner}: the placeholder seam until a real scanner exists. */
export class NoopTarballScanner implements TarballScanner {
  scan(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true });
  }
}
