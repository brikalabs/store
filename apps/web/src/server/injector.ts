import { env } from "cloudflare:workers";
import { createInjector, type Provider, runInInjectionContext } from "@brika/di";
import { DomainSecret, RegistryDb, registryBindings } from "@brika/registry-runtime";
import { getDb as getRegistryDb } from "@brika/store-db";
import { AssetsBucket, AssetsPublicUrl, CfR2BlobStore } from "@/server/adapters/cf-r2-blob-store";
import { Db, getDb } from "@/server/db/client";
import { config } from "@/server/env";
import { RequestLocale } from "@/server/i18n";
import { resolveRequestLocale } from "@/server/locale";
import { BlobStore } from "@/server/ports/blob-store";

/** The web app's composition root: the runtime values its DI graph needs. */
const webProviders: readonly Provider[] = [
  { provide: Db, useFactory: () => getDb(env.DB) },
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

/**
 * Run `fn` in the app's injection context, so handler bodies just `inject(...)`. Each request runs in
 * a thin child injector that binds {@link RequestLocale} (lazily, via `useFactory`); app-wide
 * singletons still resolve and cache in the shared parent. This is what makes `inject(ServerT)` yield
 * a translator for the current request's locale.
 */
export function runWeb<R>(fn: () => R): R {
  const requestInjector = createInjector(
    [{ provide: RequestLocale, useFactory: () => resolveRequestLocale() }],
    appInjector,
  );
  return runInInjectionContext(requestInjector, fn);
}
