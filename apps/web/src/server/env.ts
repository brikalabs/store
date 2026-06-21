import { env } from "cloudflare:workers";
import { defineEnv } from "@brika/env";
import { parseOperatorAdmins } from "@brika/registry-core";
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
    // BetterAuth base URL / trusted origin (AUTH-013): the console's public origin. Used for
    // CSRF protection and to build the provider callback (`<baseURL>/api/auth/callback/github`).
    // Defaults to production; override in .dev.vars for local dev (http://localhost:3000).
    BETTER_AUTH_URL: z.url().min(1).default("https://store.brika.dev"),
    // Stateless org domain-verification secret (ORG-010): HMAC(secret, org:domain). MUST
    // match the registry worker's DOMAIN_VERIFY_SECRET and stay stable. Security comes from
    // DNS control, not secrecy, so a dev default is fine; set a shared value in production.
    DOMAIN_VERIFY_SECRET: z.string().min(1).default("brika-dev-domain-verify-secret"),
    // Comma-separated operator allowlist gating the /operator console (provider-qualified
    // `provider:owner`, e.g. `github:octocat`; a bare entry defaults to `github`). MUST match
    // the registry worker's REGISTRY_ADMINS so the console and the takedown endpoints agree on
    // who is an operator. Empty -> no operators, so the console is unreachable until set.
    REGISTRY_ADMINS: z.string().default(""),
  },
  () => env,
);

export type Vars = ReturnType<typeof vars>;

/** The operator allowlist (provider-qualified keys), derived from `REGISTRY_ADMINS`. */
export function operatorAdmins(): ReadonlySet<string> {
  return parseOperatorAdmins(vars().REGISTRY_ADMINS);
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
