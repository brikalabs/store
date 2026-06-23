import { env } from "cloudflare:workers";
import { FixedWindowRateLimiter, type RateLimitWindow, tooManyRequests } from "@brika/router";

/**
 * Rate limiting for the store's mutation endpoints, mirroring the registry's cf-rate-limiter: a
 * Cloudflare Workers rate-limit binding is the authoritative cross-fleet control, with a per-isolate
 * in-memory fallback when the binding is unbound (local dev / tests) or errors (so infra noise never
 * 500s a legit request). Bindings are declared in `wrangler.jsonc`.
 */

/** The shape of a Cloudflare Workers rate-limit binding (`env.WRITE_LIMITER`). */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Names of the rate-limit bindings declared in `wrangler.jsonc` (the `*_LIMITER` ones). */
type LimiterBinding = `${string}_LIMITER` & keyof Cloudflare.Env;

/** Per-user mutation budget (token mint, report, avatar, device-approve). Keep in sync with WRITE_LIMITER. */
export const WRITE_WINDOW: RateLimitWindow = { limit: 20, windowSeconds: 60 };
/** Per-IP budget for the BetterAuth POST surface (sign-in/sign-out). Keep in sync with AUTH_LIMITER. */
export const AUTH_WINDOW: RateLimitWindow = { limit: 30, windowSeconds: 60 };

// One in-memory fallback per binding. Per-isolate only (see FixedWindowRateLimiter), which is why
// the Workers binding is the authoritative limit; this just covers local dev and infra blips.
const fallbacks = new Map<string, FixedWindowRateLimiter>();
function fallbackFor(binding: string, window: RateLimitWindow): FixedWindowRateLimiter {
  let limiter = fallbacks.get(binding);
  if (limiter === undefined) {
    limiter = new FixedWindowRateLimiter(window);
    fallbacks.set(binding, limiter);
  }
  return limiter;
}

// Ask the binding, falling back to the in-memory limiter when it is unbound (dev) or faults (a null
// from .catch), so a transient error never blocks a real request.
async function check(binding: LimiterBinding, key: string, window: RateLimitWindow) {
  const bound = env[binding];
  if (bound === undefined) return fallbackFor(binding, window).limit(key);
  const outcome = await bound.limit({ key }).catch(() => null);
  if (outcome === null) return fallbackFor(binding, window).limit(key);
  return outcome.success
    ? { allowed: true }
    : { allowed: false, retryAfterSeconds: window.windowSeconds };
}

/**
 * Throw `429` when `key` is over its quota on the named Workers rate-limit binding. `window` drives
 * the fallback budget + `Retry-After`; in prod the bound limit comes from wrangler.
 */
export async function enforceLimit(
  binding: LimiterBinding,
  key: string,
  window: RateLimitWindow,
): Promise<void> {
  const { allowed, retryAfterSeconds } = await check(binding, key, window);
  if (!allowed) throw tooManyRequests("Rate limit exceeded", retryAfterSeconds);
}

/**
 * The trusted client IP as a rate-limit key. `CF-Connecting-IP` is set by the edge and cannot be
 * spoofed; never trust client-supplied `X-Forwarded-For` (an attacker rotates it to mint fresh keys).
 */
export function clientKey(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}
