import { env } from "cloudflare:workers";
import { defineEnv } from "@brika/env";
import { z } from "zod";

/**
 * The store's environment, in one place.
 *
 * - Bindings (DB, CACHE, ASSETS) are runtime objects from wrangler.jsonc; their
 *   types augment `Cloudflare.Env` at the bottom of this file.
 * - String config (secrets + vars) is validated and defaulted by the schema
 *   below; read it through `vars()`.
 */
export const vars = defineEnv(
  {
    // Secrets: required, no default (set with `wrangler secret put` / .dev.vars).
    SESSION_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    // Non-secret: defaults to the production callback. Override in .dev.vars for
    // local dev (http://localhost:3000/auth/github/callback).
    GITHUB_REDIRECT_URI: z.url().min(1).default("https://store.brika.dev/auth/github/callback"),
  },
  () => env,
);

export type Vars = ReturnType<typeof vars>;

// Binding types for `env` from "cloudflare:workers" (sourced from wrangler.jsonc).
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      CACHE: KVNamespace;
      ASSETS: R2Bucket;
    }
  }
}
