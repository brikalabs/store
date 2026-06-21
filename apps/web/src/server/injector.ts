import { env } from "cloudflare:workers";
import type { Provider } from "@brika/di";
import { BlobStore, CfR2BlobStore } from "@/server/blob-store";
import { Database, getDb } from "@/server/db/client";
import { RegistryDatabase, registryDb } from "@/server/registry-services";

/**
 * The web app's per-request DI seam, as plain data: the few values that come from the runtime,
 * each provided on its own (no grouping). This is the ONLY place `cloudflare:workers` `env` is
 * read; the store/db/blob classes stay binding-free and test-safe. Everything else self-builds:
 * stores + `SocialService` + `Registry` are concrete classes that `inject(...)` these and so
 * auto-resolve. Code never builds an injector by hand - `runHandler` and the server-function
 * loaders pass this to `runInContext(webProviders, ...)`, then it is all `inject(...)`.
 */
export const webProviders: readonly Provider[] = [
  { provide: Database, useFactory: () => new Database(getDb(env.DB)) },
  { provide: RegistryDatabase, useFactory: () => new RegistryDatabase(registryDb()) },
  { provide: BlobStore, useFactory: () => new CfR2BlobStore(env.ASSETS) },
];
