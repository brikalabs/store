import { inject, token } from "@brika/di";
import {
  type AbbreviatedPackument,
  buildAbbreviatedPackument,
  buildPackument,
  type Packument,
  tarballPath,
} from "./packument";
import { MetadataReader, TarballReader } from "./ports";
import type { PackageRecord } from "./types";

/** Public base URL of the registry, e.g. `https://registry.brika.dev` - injected by the app. */
export const RegistryBaseUrl = token<string>("RegistryBaseUrl");

export interface PackumentOptions {
  /** Return the abbreviated install metadata instead of the full document. */
  readonly abbreviated?: boolean;
}

/**
 * The npm-compatible resolution surface: packument lookup and tarball streaming. All `bun add`
 * needs; publishing is a separate service.
 */
export class ResolveService {
  readonly #meta = inject(MetadataReader);
  readonly #tarballs = inject(TarballReader);
  readonly #baseUrl = inject(RegistryBaseUrl);

  /** Build the npm packument for a package, or null when it is unknown or taken down. */
  async packument(
    name: string,
    options: PackumentOptions = {},
  ): Promise<Packument | AbbreviatedPackument | null> {
    const record = await this.#meta.getPackage(name);
    if (record === null || isTakenDown(record)) return null;
    return options.abbreviated
      ? buildAbbreviatedPackument(record, this.#baseUrl)
      : buildPackument(record, this.#baseUrl);
  }

  /**
   * Stream a tarball by package name and version, or null when absent or taken down. An operator
   * takedown of the whole package or its scope also withdraws the bytes (unlike a yank, which keeps
   * them for pinned lockfiles), so a direct tarball URL 404s too.
   */
  async tarball(name: string, version: string): Promise<ReadableStream<Uint8Array> | null> {
    const record = await this.#meta.getPackage(name);
    if (record === null || isTakenDown(record)) return null;
    return this.#tarballs.get(tarballPath(name, version));
  }
}

/** True when an operator has withdrawn the whole package or its owning scope. */
function isTakenDown(record: PackageRecord): boolean {
  return record.takedown !== null || record.scopeTakedown !== null;
}
