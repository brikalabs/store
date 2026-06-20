import { env } from "cloudflare:workers";
import { defineEnv } from "@brika/env";
import { parseOperatorAdmins } from "@brika/registry-core";
import { z } from "zod";
import type { CfRateLimitBinding } from "./adapters/cf-rate-limiter";

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
    // Canonical public origin of THIS registry, used to build the `dist.tarball`
    // URLs in every packument. Pinning it here (rather than trusting the request
    // `Host`) means a spoofed `Host` header can never make us advertise tarballs
    // on another origin, and it lets local dev point bun at `localhost` (set
    // REGISTRY_URL=http://localhost:8787 in .dev.vars). Empty -> fall back to the
    // request origin, which is correct once a single custom domain is attached.
    REGISTRY_URL: z.union([z.url(), z.literal("")]).default(""),
    // Comma-separated operator admins allowed to take down / restore versions
    // (distinct from scope ownership). Each entry is `provider:owner` (e.g.
    // `github:octocat`); a bare entry defaults to the `github` provider. Empty -> no
    // admins, so the takedown endpoints reject everyone until set via
    // `wrangler secret`/`.dev.vars`.
    REGISTRY_ADMINS: z.string().default(""),
    // Secret for deriving stateless scope domain-verification challenges (ORG-010): the TXT
    // token is HMAC(secret, scope:domain). MUST match the store worker's value (both derive
    // the same token) and stay STABLE (rotating it invalidates every published TXT). The
    // token's security comes from DNS control, not secrecy, so a dev default is acceptable;
    // set a real shared value in production via `wrangler secret`.
    DOMAIN_VERIFY_SECRET: z.string().min(1).default("brika-dev-domain-verify-secret"),
  },
  () => env,
);

export type Vars = ReturnType<typeof vars>;

/**
 * The operator admins allowed to perform takedown/restore, as provider-qualified
 * `provider:owner` keys (matching how `requireAdmin` compares an identity). A bare
 * `REGISTRY_ADMINS` entry without a provider defaults to `github`, so existing
 * GitHub-login lists keep working while the check stays correct once a second
 * identity provider is added.
 */
export function registryAdmins(): ReadonlySet<string> {
  return parseOperatorAdmins(vars().REGISTRY_ADMINS);
}

// Binding types for `env` from "cloudflare:workers" (sourced from wrangler.jsonc).
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      TARBALLS: R2Bucket;
      // Workers rate-limit bindings. Optional: absent in tests and local dev, where
      // `bindingRateLimiter` (cf-rate-limiter.ts) falls back to its in-memory limiter.
      PUBLISH_LIMITER?: CfRateLimitBinding;
      DEVICE_LIMITER?: CfRateLimitBinding;
      CLAIM_LIMITER?: CfRateLimitBinding;
    }
  }
}
