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
  /** Read an object's bytes by key, or null when it is absent. For small objects you parse. */
  get(key: string): Promise<Uint8Array | null>;
  /** Open an object for streaming by key, or null when absent. For serving bytes straight to a
   *  `Response` without buffering them into memory. */
  getStream(key: string): Promise<BlobStream | null>;
  /** Write an object, optionally tagging its content type for direct serving. */
  put(key: string, value: Uint8Array | string, contentType?: string): Promise<void>;
  /** Remove an object by key (idempotent). Compensates a staged put when a transaction rolls back. */
  delete(key: string): Promise<void>;
}

/** An object opened for streaming: the body plus the metadata needed to serve it without buffering. */
export interface BlobStream {
  readonly body: ReadableStream<Uint8Array>;
  /** Byte length, for a `Content-Length` header. */
  readonly size: number;
  /** The content type stored with the object, if any. */
  readonly contentType?: string;
}

/** The DI token for the {@link BlobStore} port (merged with the interface: `inject(BlobStore)`). */
export const BlobStore = token<BlobStore>();
