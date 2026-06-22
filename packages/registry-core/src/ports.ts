import { token } from "@brika/di";
import type { PackageRecord } from "./types";

/**
 * Storage ports. The domain core depends only on these interfaces; concrete
 * adapters (Cloudflare D1, R2) live in the registry app. This keeps the core
 * runtime-agnostic and unit-testable with in-memory fakes. Each port also gets a
 * same-named DI token so a service field-injects it (`inject(MetadataReader)`) and
 * the app binds the token to its adapter.
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
