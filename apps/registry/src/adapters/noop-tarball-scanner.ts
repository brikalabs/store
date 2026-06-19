import type { TarballScanner } from "@brika/registry-core";

/**
 * Allow-all {@link TarballScanner}: the placeholder wired into the publish pipeline
 * until a real scanner exists. This is the seam: swap it in `buildServices` for a
 * ClamAV/external-service adapter or a heuristic pass over `readTarGzEntries`
 * (suspicious paths, embedded binaries, install-script red flags) and every publish
 * is scanned with no change to the orchestration.
 */
export class NoopTarballScanner implements TarballScanner {
  scan(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true });
  }
}
