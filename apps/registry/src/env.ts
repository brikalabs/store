import { env } from "cloudflare:workers";
import { defineEnv } from "@brika/env";
import { z } from "zod";

/**
 * The registry's environment, in one place.
 *
 * - Bindings (DB, TARBALLS) are runtime objects from wrangler.jsonc; their types
 *   augment `Cloudflare.Env` at the bottom of this file.
 * - String config is validated and defaulted by the schema below; read it
 *   through `vars()`.
 */
export const vars = defineEnv(
  {
    // Base URL of the store that hosts the device-approval page. Defaults to
    // prod; set in .dev.vars (http://localhost:3000) to run the flow locally.
    STORE_URL: z.url().min(1).default("https://store.brika.dev"),
  },
  () => env,
);

export type Vars = ReturnType<typeof vars>;

// Binding types for `env` from "cloudflare:workers" (sourced from wrangler.jsonc).
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      TARBALLS: R2Bucket;
    }
  }
}
