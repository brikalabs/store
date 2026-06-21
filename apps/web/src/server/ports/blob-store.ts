import { token } from "@brika/di";

/**
 * Object-storage PORT for the web's mirrored assets (extracted tarball files, the file index) and
 * scope icons. The domain reads/writes blobs by key and does not care whether they live in
 * Cloudflare R2, S3, or a local disk. An interface (the contract) plus a same-named DI token, so a
 * call site does `inject(BlobStore)` and the composition root binds the R2 adapter
 * (`apps/web/src/server/adapters/cf-r2-blob-store.ts`). A different host is a new adapter
 * implementing this, with no change to the call sites.
 */
export interface BlobStore {
  /** Open an object by key, or null when absent. The result carries its metadata and gives the body
   *  either as a stream (serve it straight to a `Response`) or buffered (`bytes()`, to parse). */
  get(key: string): Promise<BlobObject | null>;
  /** The object's public URL on the bucket's CDN domain, for serving it directly (no worker hop).
   *  Only meaningful for publicly-readable objects (e.g. scope icons, user avatars). */
  url(key: string): string;
  /** Write an object, optionally tagging its content type for direct serving. */
  put(key: string, value: Uint8Array | string, contentType?: string): Promise<void>;
  /** Remove an object by key (idempotent). Compensates a staged put when a transaction rolls back. */
  delete(key: string): Promise<void>;
}

/**
 * An object read from the store: its metadata plus the body. Mirrors a Cloudflare R2 object. The
 * body is a single stream, so consume it ONCE - either `body` (stream to a `Response`, no buffering)
 * OR `bytes()` (buffer into memory to parse), not both.
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

/** The DI token for the {@link BlobStore} port (merged with the interface: `inject(BlobStore)`). */
export const BlobStore = token<BlobStore>();
