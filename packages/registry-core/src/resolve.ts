import {
  type AbbreviatedPackument,
  buildAbbreviatedPackument,
  buildPackument,
  type Packument,
  tarballPath,
} from "./packument";
import type { MetadataReader, TarballReader } from "./ports";

export interface ResolveOptions {
  /** Public base URL of the registry, e.g. `https://registry.brika.dev`. */
  readonly baseUrl: string;
}

export interface PackumentOptions {
  /** Return the abbreviated install metadata instead of the full document. */
  readonly abbreviated?: boolean;
}

/**
 * The npm-compatible resolution surface: packument lookup and tarball streaming.
 * This is all the hub's `bun add` needs; publishing is a separate service.
 */
export class ResolveService {
  readonly #meta: MetadataReader;
  readonly #tarballs: TarballReader;
  readonly #baseUrl: string;

  constructor(meta: MetadataReader, tarballs: TarballReader, options: ResolveOptions) {
    this.#meta = meta;
    this.#tarballs = tarballs;
    this.#baseUrl = options.baseUrl;
  }

  /** Build the npm packument for a package, or null when it is unknown. */
  async packument(
    name: string,
    options: PackumentOptions = {},
  ): Promise<Packument | AbbreviatedPackument | null> {
    const record = await this.#meta.getPackage(name);
    if (record === null) return null;
    return options.abbreviated
      ? buildAbbreviatedPackument(record, this.#baseUrl)
      : buildPackument(record, this.#baseUrl);
  }

  /** Stream a tarball by package name and version, or null when absent. */
  tarball(name: string, version: string): Promise<ReadableStream<Uint8Array> | null> {
    return this.#tarballs.get(tarballPath(name, version));
  }
}
