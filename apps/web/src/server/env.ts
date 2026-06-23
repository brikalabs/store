import { env } from "cloudflare:workers";
import { inject, token } from "@brika/di";
import { defineEnv } from "@brika/env";
import { parseOperatorAdmins } from "@brika/registry-core";
import { z } from "zod";
import type { RateLimitBinding } from "@/server/rate-limit";

/** The store's environment: string config validated by the schema below, read through {@link config}. */
const readEnv = defineEnv(
  {
    // Secrets: required, no default (set with `wrangler secret put` / .dev.vars).
    SESSION_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_REDIRECT_URI: z.url().min(1).default("https://store.brika.dev/auth/github/callback"),
    // BetterAuth base URL / trusted origin (AUTH-013): the console's public origin, used for CSRF
    // protection and to build the provider callback (`<baseURL>/api/auth/callback/github`).
    BETTER_AUTH_URL: z.url().min(1).default("https://store.brika.dev"),
    // Stateless scope domain-verification secret (ORG-010): HMAC(secret, scope:domain). REQUIRED,
    // set per deployment, and MUST match the registry worker's DOMAIN_VERIFY_SECRET (security is DNS
    // control, not the secret's secrecy).
    DOMAIN_VERIFY_SECRET: z.string().min(1),
    // Operator allowlist gating /operator (Brika account ids). MUST match the registry worker's
    // REGISTRY_ADMINS so the console and the takedown endpoints agree on who is an operator.
    REGISTRY_ADMINS: z.string().default(""),
    // Public base URL of the ASSETS R2 bucket, used to build public object URLs (e.g. uploaded
    // avatars). No default: deployment-specific, and a wrong value would silently produce dead URLs.
    ASSETS_PUBLIC_URL: z.url().optional(),
  },
  () => env,
);

export type Vars = ReturnType<typeof readEnv>;

/** The validated config as an isolate-singleton injectable. Private: read it through {@link config}. */
const Env = token<Vars>("Env", readEnv);

/** The validated config ({@link Vars}) for the current request. THE way to read config on the server. */
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
      // Rate-limit bindings (see server/rate-limit.ts). Unbound in dev -> in-memory fallback.
      WRITE_LIMITER?: RateLimitBinding;
      AUTH_LIMITER?: RateLimitBinding;
    }
  }
}
