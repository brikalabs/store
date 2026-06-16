import { createRouter } from "@brika/router";
import type { Services } from "../services";

/**
 * The registry's router, bound once to its per-request context (the {@link Services}
 * graph) and its Hono environment. Controllers import `route` and `controller`
 * from here so every handler gets a typed `ctx: Services`; `index.ts` calls
 * `mount` with the actual context factory + the npm `:name` preset. This module is
 * free of Cloudflare imports, so controllers (and their tests) can import it
 * without the Workers runtime.
 */

/** The registry's Hono environment: the Cloudflare bindings, exposed as `c.env`. */
export type RegistryEnv = { Bindings: Cloudflare.Env };

export const { route, controller, mount, routes, logRoutes } = createRouter<
  Services,
  RegistryEnv
>();
