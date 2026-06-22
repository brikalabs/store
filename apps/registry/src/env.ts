import { env } from "cloudflare:workers";
import { defineEnv } from "@brika/env";
import { parseOperatorAdmins } from "@brika/registry-core";
import { z } from "zod";
import type { CfRateLimitBinding } from "./adapters/cf-rate-limiter";

/** The registry's environment: bindings augment `Cloudflare.Env` below; string config read via `vars()`. */
export const vars = defineEnv(
  {
    // Base URL of the store hosting the device-approval page.
    STORE_URL: z.url().min(1).default("https://store.brika.dev"),
    // Canonical public origin of THIS registry, used to build `dist.tarball` URLs. Pinned (not the
    // request `Host`) so a spoofed `Host` can never make us advertise tarballs on another origin.
    // Empty -> fall back to the request origin (correct once a single custom domain is attached).
    REGISTRY_URL: z.union([z.url(), z.literal("")]).default(""),
    // Operator admins (Brika account ids) for takedown/restore, distinct from scope ownership.
    // Empty -> no admins, so the takedown endpoints reject everyone until set.
    REGISTRY_ADMINS: z.string().default(""),
    // Secret deriving stateless scope domain-verification TXT challenges, HMAC(secret, scope:domain)
    // (ORG-010). MUST match the store worker's value and stay STABLE (rotating invalidates every
    // published TXT). Security comes from DNS control, not secrecy, so a dev default is acceptable.
    DOMAIN_VERIFY_SECRET: z.string().min(1).default("brika-dev-domain-verify-secret"),
  },
  () => env,
);

export type Vars = ReturnType<typeof vars>;

/**
 * The operator admins allowed to perform takedown/restore, as Brika account ids
 * (`users.id`, matching how `requireAdmin` compares an identity's `userId`).
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
