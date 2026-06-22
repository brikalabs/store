import { env } from "cloudflare:workers";
import { createInjector, type Provider, runInInjectionContext } from "@brika/di";
import { DomainSecret, RegistryDb, registryBindings } from "@brika/registry-runtime";
import { getDb as getRegistryDb } from "@brika/store-db";
import { AssetsBucket, AssetsPublicUrl, CfR2BlobStore } from "@/server/adapters/cf-r2-blob-store";
import { Database, getDb } from "@/server/db/client";
import { config } from "@/server/env";
import { BlobStore } from "@/server/ports/blob-store";

/** The web app's composition root: the runtime values its DI graph needs. */
const webProviders: readonly Provider[] = [
  { provide: Database, useFactory: () => getDb(env.DB) },
  { provide: AssetsBucket, useFactory: () => env.ASSETS },
  { provide: AssetsPublicUrl, useFactory: () => config().ASSETS_PUBLIC_URL },
  { provide: BlobStore, useClass: CfR2BlobStore },
  { provide: RegistryDb, useFactory: () => getRegistryDb(env.DB) },
  { provide: DomainSecret, useFactory: () => config().DOMAIN_VERIFY_SECRET },
  ...registryBindings,
];

/**
 * The web app's injector, one per isolate. Providers are singletons - correct because the
 * bindings/config are isolate-stable, nothing here is per-request.
 */
const appInjector = createInjector(webProviders);

/** Run `fn` in the app's injection context, so handler bodies just `inject(...)`. */
export function runWeb<R>(fn: () => R): R {
  return runInInjectionContext(appInjector, fn);
}
