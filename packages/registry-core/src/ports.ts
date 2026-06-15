import type { PackageRecord } from "./types";

/**
 * Storage ports. The domain core depends only on these interfaces; concrete
 * adapters (Cloudflare D1, R2) live in the registry app. This keeps the core
 * runtime-agnostic and unit-testable with in-memory fakes.
 */

/** Read access to package metadata, used to resolve packuments. */
export interface MetadataReader {
  getPackage(name: string): Promise<PackageRecord | null>;
}

/** Read access to immutable tarball objects, used to serve downloads. */
export interface TarballReader {
  /** Stream a tarball by its object key, or null when absent. */
  get(key: string): Promise<ReadableStream<Uint8Array> | null>;
}
