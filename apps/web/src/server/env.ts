import { env } from "cloudflare:workers";
import { InjectionToken, inject } from "@brika/di";
import { defineEnv } from "@brika/env";
import { parseOperatorAdmins } from "@brika/registry-core";
import { z } from "zod";

/**
 * The store's environment, in one place.
 *
 * - Bindings (DB, CACHE, ASSETS) are runtime objects from wrangler.jsonc; their
 *   types augment `Cloudflare.Env` at the bottom of this file.
 * - String config (secrets + vars) is validated and defaulted by the schema
 *   below; read it through {@link config} (never `cloudflare:workers` env directly).
 */
const readEnv = defineEnv(
  {
    // Secrets: required, no default (set with `wrangler secret put` / .dev.vars).
    SESSION_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    // Non-secret: defaults to the production callback. Override in .dev.vars for
    // local dev (http://localhost:3000/auth/github/callback).
    GITHUB_REDIRECT_URI: z.url().min(1).default("https://store.brika.dev/auth/github/callback"),
    // BetterAuth base URL / trusted origin (AUTH-013): the console's public origin. Used for
    // CSRF protection and to build the provider callback (`<baseURL>/api/auth/callback/github`).
    // Defaults to production; override in .dev.vars for local dev (http://localhost:3000).
    BETTER_AUTH_URL: z.url().min(1).default("https://store.brika.dev"),
    // Stateless org domain-verification secret (ORG-010): HMAC(secret, org:domain). MUST
    // match the registry worker's DOMAIN_VERIFY_SECRET and stay stable. Security comes from
    // DNS control, not secrecy, so a dev default is fine; set a shared value in production.
    DOMAIN_VERIFY_SECRET: z.string().min(1).default("brika-dev-domain-verify-secret"),
    // Comma-separated operator allowlist gating the /operator console (Brika account ids,
    // `users.id`). MUST match the registry worker's REGISTRY_ADMINS so the console and the
    // takedown endpoints agree on who is an operator. Empty -> no operators, so the console is
    // unreachable until set.
    REGISTRY_ADMINS: z.string().default(""),
    // Public base URL of the ASSETS R2 bucket, used to build public object URLs for directly-served
    // assets like uploaded user avatars. Set it to the bucket's managed r2.dev URL (enable public
    // access on the bucket -> `https://pub-<hash>.r2.dev`) or a custom domain. No default: it is
    // deployment-specific, and a wrong value would silently produce dead URLs. Unset -> avatar
    // upload fails loudly (the rest of the app is unaffected).
    ASSETS_PUBLIC_URL: z.url().optional(),
  },
  () => env,
);

export type Vars = ReturnType<typeof readEnv>;

/** The validated config as an isolate-singleton injectable (built once from the binding). Private:
 *  app code reads it through {@link config}, not `inject(Env)`. */
const Env = new InjectionToken<Vars>({ description: "Env", factory: readEnv });

/** The validated config ({@link Vars}) for the current request, from the DI context. THE way to read
 *  config anywhere on the server - replaces touching `cloudflare:workers` env / a raw reader. */
export const config = (): Vars => inject(Env);

/** The operator allowlist (Brika account ids), derived from `REGISTRY_ADMINS`. */
export function operatorAdmins(): ReadonlySet<string> {
  return parseOperatorAdmins(config().REGISTRY_ADMINS);
}

// Binding types for `env` from "cloudflare:workers" (sourced from wrangler.jsonc).
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      // @unenforced: provisioned for npm-metadata cache-aside, not wired yet
      CACHE: KVNamespace;
      ASSETS: R2Bucket;
    }
  }
}
