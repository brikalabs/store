import { InjectionToken, inject } from "@brika/di";
import type { BlobStore } from "@/server/blob-store";
import { CfR2BlobStore } from "@/server/blob-store";
import type { Db } from "@/server/db/client";
import { getDb } from "@/server/db/client";

/**
 * The DI tokens for the request-scoped bindings. ENV is the ONLY thing the framework adapter
 * declares (the Cloudflare bindings for the request); everything else self-provides from it via
 * a default factory (Angular's `providedIn: 'root'`), so the composition root only ever hands in
 * ENV and the rest of the graph wires itself. A handler never reads `env` directly.
 *
 * Test-safe: the factories close over `inject(ENV)`, not the `cloudflare:workers` import, so a
 * unit test can `import { DB }` and override it with an in-memory db without touching the runtime.
 */
export const ENV = new InjectionToken<Cloudflare.Env>();

/** The store/social D1 client (drizzle over `ENV.DB`). */
export const DB = new InjectionToken<Db>({ factory: () => getDb(inject(ENV).DB) });

/** The R2-backed object store for mirrored assets + scope icons (over `ENV.ASSETS`). */
export const ASSETS = new InjectionToken<BlobStore>({
  factory: () => new CfR2BlobStore(inject(ENV).ASSETS),
});
