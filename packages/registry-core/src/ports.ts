import { token } from "@brika/di";
import type { PackageRecord } from "./types";

/**
 * Storage ports. The domain core depends only on these interfaces; concrete adapters (D1, R2) live
 * in the registry app, keeping the core runtime-agnostic and testable with in-memory fakes.
 */

/** Read access to package metadata, used to resolve packuments. */
export interface MetadataReader {
  getPackage(name: string): Promise<PackageRecord | null>;
}
/** DI token for the {@link MetadataReader} port. */
export const MetadataReader = token<MetadataReader>("MetadataReader");

/** Read access to immutable tarball objects, used to serve downloads. */
export interface TarballReader {
  /** Stream a tarball by its object key, or null when absent. */
  get(key: string): Promise<ReadableStream<Uint8Array> | null>;
}
/** DI token for the {@link TarballReader} port. */
export const TarballReader = token<TarballReader>("TarballReader");
