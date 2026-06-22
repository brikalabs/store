import { inject, token } from "@brika/di";
import {
  type AbbreviatedPackument,
  buildAbbreviatedPackument,
  buildPackument,
  type Packument,
  tarballPath,
} from "./packument";
import { MetadataReader, TarballReader } from "./ports";

/** Public base URL of the registry, e.g. `https://registry.brika.dev` - injected by the app. */
export const RegistryBaseUrl = token<string>("RegistryBaseUrl");

export interface PackumentOptions {
  /** Return the abbreviated install metadata instead of the full document. */
  readonly abbreviated?: boolean;
}

/**
 * The npm-compatible resolution surface: packument lookup and tarball streaming.
 * This is all the hub's `bun add` needs; publishing is a separate service.
 *
 * Injectable (`@brika/di`): field injection, no constructor. The app binds the
 * {@link MetadataReader} / {@link TarballReader} ports + the {@link RegistryBaseUrl};
 * a test runs it in an injection context that provides them.
 */
export class ResolveService {
  readonly #meta = inject(MetadataReader);
  readonly #tarballs = inject(TarballReader);
  readonly #baseUrl = inject(RegistryBaseUrl);

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
