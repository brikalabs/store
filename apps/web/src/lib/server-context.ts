import { env } from "cloudflare:workers";
import { type Db, getDb } from "@/db/client";
import { type BlobStore, CfR2BlobStore } from "./blob-store";

/**
 * The store's per-request composition root. It reads the Cloudflare bindings in
 * one place and returns the request-scoped dependencies a server route needs, so
 * handlers depend on this context instead of reaching for the ambient `env`.
 * Construction is cheap (thin wrappers over the bindings), so it is built once
 * per request: `const { db, assets } = serverContext()`.
 */
export interface ServerContext {
  /** Drizzle client over the store's D1 database (store/social tables). */
  readonly db: Db;
  /** Object store for mirrored tarball assets and the file index. */
  readonly assets: BlobStore;
}

export function serverContext(): ServerContext {
  return { db: getDb(env.DB), assets: new CfR2BlobStore(env.ASSETS) };
}
