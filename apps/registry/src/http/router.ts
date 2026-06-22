import { createRouter } from "@brika/router";

/**
 * The registry's router. Handlers resolve dependencies via `@brika/di` inside the per-request
 * injection context, so the context type is `void` (nothing to thread). Free of Cloudflare imports,
 * so controllers and their tests import it without the Workers runtime.
 */

/** The registry's Hono environment: the Cloudflare bindings, exposed as `c.env`. */
export type RegistryEnv = { Bindings: Cloudflare.Env };

export const { route, controller, mount, routes, logRoutes } = createRouter<void, RegistryEnv>();
