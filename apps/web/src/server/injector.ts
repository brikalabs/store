import { env } from "cloudflare:workers";
import { createInjector, type Injector, inject } from "@brika/di";
import { registryDb, registryServices } from "@/server/registry-services";
import { ENV, REG_DB, REGISTRY } from "@/server/tokens";

/**
 * A fresh per-request injector for the web app. ENV is the ONLY binding declared here - the
 * Cloudflare bindings for this request. The store side self-wires: DB and ASSETS resolve from
 * ENV via their token default factories, and every store + {@link SocialService} auto-resolves
 * (a concrete class is its own provider). The `reg_*` graph can't self-wire from a token default
 * factory - `@brika/registry-core` is a PURE package and must not import `@brika/di` - so it's
 * provided here via `useFactory`: REG_DB builds the registry drizzle client and REGISTRY wires
 * the service graph over it. So a handler just `inject(REGISTRY)`/`inject(REG_DB)` and the whole
 * graph is built lazily in this scope.
 */
export function webInjector(): Injector {
  return createInjector([
    { provide: ENV, useValue: env },
    { provide: REG_DB, useFactory: () => registryDb() },
    { provide: REGISTRY, useFactory: () => registryServices(inject(REG_DB)) },
  ]);
}
