import { env } from "cloudflare:workers";
import type { Provider } from "@brika/di";
import { CfR2BlobStore } from "@/server/adapters/cf-r2-blob-store";
import { Database, getDb } from "@/server/db/client";
import { BlobStore } from "@/server/ports/blob-store";
import { RegistryDatabase, registryDb, registryProviders } from "@/server/registry-services";

/**
 * The web app's per-request DI seam, as plain data: the few values that come from the runtime,
 * each provided on its own (no grouping). This is the ONLY place `cloudflare:workers` `env` is
 * read; the store/db/blob classes stay binding-free and test-safe. Everything else self-builds:
 * stores + `SocialService` are concrete classes that `inject(...)` these and so auto-resolve, and
 * the reg_* services come from {@link registryProviders}. Code never builds an injector by hand -
 * `runHandler` and the server-function loaders pass this to `runInContext(webProviders, ...)`.
 */
export const webProviders: readonly Provider[] = [
  { provide: Database, useFactory: () => new Database(getDb(env.DB)) },
  { provide: RegistryDatabase, useFactory: () => new RegistryDatabase(registryDb()) },
  { provide: BlobStore, useFactory: () => new CfR2BlobStore(env.ASSETS) },
  ...registryProviders,
];
