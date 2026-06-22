import { token } from "@brika/di";

/**
 * Object-storage PORT for the web's mirrored assets (extracted tarball files, the file index) and
 * scope icons, keyed by string and host-agnostic (R2, S3, local disk). The R2 adapter binds it.
 */
export interface BlobStore {
  /** Open an object by key, or null when absent. */
  get(key: string): Promise<BlobObject | null>;
  /** The object's public CDN URL (no worker hop), or undefined when no public base URL is configured.
   *  Built fresh each call, so it always reflects the current configured base - nothing stores it. */
  url(key: string): string | undefined;
  /** Write an object, optionally tagging its content type for direct serving. */
  put(key: string, value: Uint8Array | string, contentType?: string): Promise<void>;
  /** Remove an object by key (idempotent). Compensates a staged put when a transaction rolls back. */
  delete(key: string): Promise<void>;
}

/**
 * An object read from the store: its metadata plus the body. The body is a single stream, so consume
 * it ONCE - either `body` (stream to a `Response`) OR `bytes()` (buffer to parse), not both.
 */
export interface BlobObject {
  /** Byte length, for a `Content-Length` header. */
  readonly size: number;
  /** The content type stored with the object, if any. */
  readonly contentType?: string;
  /** A quoted entity tag for the content, for `ETag` + `If-None-Match` revalidation, when the
   *  backend provides one (R2 does). Undefined for backends that do not. */
  readonly etag?: string;
  /** The body as a stream - pipe it straight to a `Response` without buffering. */
  readonly body: ReadableStream<Uint8Array>;
  /** The body buffered into memory - for a small object you parse (e.g. the JSON file index). */
  bytes(): Promise<Uint8Array>;
}

/** The DI token for the {@link BlobStore} port. */
export const BlobStore = token<BlobStore>("BlobStore");
