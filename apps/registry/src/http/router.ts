import { createRouter } from "@brika/router";

/**
 * The registry's router, bound to its Hono environment. Handlers resolve their dependencies with
 * `@brika/di` (`inject(ScopeService)`, ...) inside the per-request injection context that
 * `index.ts` establishes via `mount({ around })`, so there is no `ctx` to thread (the context type
 * is `void`). This module is free of Cloudflare imports, so controllers (and their tests) can
 * import it without the Workers runtime.
 */

/** The registry's Hono environment: the Cloudflare bindings, exposed as `c.env`. */
export type RegistryEnv = { Bindings: Cloudflare.Env };

export const { route, controller, mount, routes, logRoutes } = createRouter<void, RegistryEnv>();
