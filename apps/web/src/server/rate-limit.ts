import { env } from "cloudflare:workers";
import {
  fallbackRateLimiter,
  type RateLimitProbe,
  type RateLimitWindow,
  tooManyRequests,
  trustedIpKey,
} from "@brika/router";

/**
 * Rate limiting for the store's mutation endpoints. Each binding's limiter (the authoritative
 * cross-fleet Workers binding, with a per-isolate in-memory fallback) is built once here; routes
 * call {@link enforceLimit}. Shares the binding+fallback + IP-keying core with the registry via
 * `@brika/router`. Bindings live in `wrangler.jsonc`; their limits must match the windows below.
 */

/** The shape of a Cloudflare Workers rate-limit binding (`env.WRITE_LIMITER`). */
export type RateLimitBinding = RateLimitProbe;

/** Per-user mutation budget (token mint, report, avatar, device-approve). Keep in sync with WRITE_LIMITER. */
const WRITE_WINDOW: RateLimitWindow = { limit: 20, windowSeconds: 60 };
/** Per-IP budget for the BetterAuth POST surface (sign-in/sign-out). Keep in sync with AUTH_LIMITER. */
const AUTH_WINDOW: RateLimitWindow = { limit: 30, windowSeconds: 60 };

// Built once so the in-memory fallback persists; the thunk reads env lazily (per request), so the
// binding need not be bound at module load (dev / tests fall through to the in-memory limiter).
const limiters = {
  WRITE_LIMITER: fallbackRateLimiter(WRITE_WINDOW, () => env.WRITE_LIMITER),
  AUTH_LIMITER: fallbackRateLimiter(AUTH_WINDOW, () => env.AUTH_LIMITER),
};

/**
 * Throw `429` when `key` is over its quota on the named rate-limit binding. In prod the bound limit
 * comes from wrangler; the window here drives the in-memory fallback + `Retry-After`.
 */
export async function enforceLimit(binding: keyof typeof limiters, key: string): Promise<void> {
  const { allowed, retryAfterSeconds } = await limiters[binding].limit(key);
  if (!allowed) throw tooManyRequests("Rate limit exceeded", retryAfterSeconds);
}

/** The trusted client IP as a rate-limit key (CF-Connecting-IP, /64-normalized; never a spoofable header). */
export function clientKey(request: Request): string {
  return trustedIpKey(request.headers.get("cf-connecting-ip"));
}
