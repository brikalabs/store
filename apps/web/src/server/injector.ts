import { env } from "cloudflare:workers";
import { createInjector, type Provider, runInInjectionContext } from "@brika/di";
import { DomainSecret, RegistryDb, registryBindings } from "@brika/registry-runtime";
import { getDb as getRegistryDb } from "@brika/store-db";
import { AssetsBucket, AssetsPublicUrl, CfR2BlobStore } from "@/server/adapters/cf-r2-blob-store";
import { Database, getDb } from "@/server/db/client";
import { config } from "@/server/env";
import { BlobStore } from "@/server/ports/blob-store";

/**
 * The web app's composition root - the runtime values its DI graph needs. `Database` (store schema)
 * + the `BlobStore` R2 adapter are bound here; the registry domain comes from the
 * `@brika/registry-runtime` feature library, so we only provide its two inputs (`RegistryDb` from the
 * shared D1, `DomainSecret` from config) and alias the `@brika/registry-core` classes to the
 * library's wired tokens - handlers keep `inject(ScopeService)` / `inject(ManagementService)`, and
 * `inject(Audit)` / `inject(MetadataReader)` / ... resolve straight from the library.
 */
const webProviders: readonly Provider[] = [
  { provide: Database, useFactory: () => getDb(env.DB) },
  // The R2 assets adapter, field-injected off these two seams.
  { provide: AssetsBucket, useFactory: () => env.ASSETS },
  { provide: AssetsPublicUrl, useFactory: () => config().ASSETS_PUBLIC_URL },
  { provide: BlobStore, useClass: CfR2BlobStore },
  { provide: RegistryDb, useFactory: () => getRegistryDb(env.DB) },
  { provide: DomainSecret, useFactory: () => config().DOMAIN_VERIFY_SECRET },
  // The registry domain: `ScopeService`/`ManagementService` self-resolve (field injection); these
  // bind the ports they inject to the D1 adapters. Handlers `inject(ScopeService)` etc. directly.
  ...registryBindings,
];

/**
 * The web app's injector, one per isolate. Tokens resolve once and cache, so each provider is a
 * singleton - correct because the bindings/config are isolate-stable, nothing here is per-request.
 * Eager: `createInjector` only stores the list; factories run lazily on first `inject`.
 */
const appInjector = createInjector(webProviders);

/**
 * Run `fn` in the app's injection context, so handler bodies just `inject(...)`. Every server entry
 * point goes through it; unit tests build their own `createInjector([...])` with fakes instead.
 */
export function runWeb<R>(fn: () => R): R {
  return runInInjectionContext(appInjector, fn);
}
