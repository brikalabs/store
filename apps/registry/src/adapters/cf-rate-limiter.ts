import { env } from "cloudflare:workers";
import {
  fallbackRateLimiter,
  type RateLimiter,
  type RateLimitProbe,
  type RateLimitWindow,
  trustedIpKey,
} from "@brika/router";

/** The shape of a Cloudflare Workers rate-limit binding (`env.MY_LIMITER`). */
export type CfRateLimitBinding = RateLimitProbe;

/** Names of the rate-limit bindings declared in `wrangler.jsonc` (the `*_LIMITER` ones). */
type LimiterBinding = `${string}_LIMITER` & keyof Cloudflare.Env;

/**
 * A {@link RateLimiter} over the named Workers binding, failing open to a per-instance in-memory
 * fallback when unbound (dev/tests) or on error, so infra noise never 500s a publish/login. The
 * binding is read lazily so it need not exist at module load.
 */
export function bindingRateLimiter(binding: LimiterBinding, window: RateLimitWindow): RateLimiter {
  return fallbackRateLimiter(window, () => env[binding]);
}

/** A `store:` factory for `rateLimit`, backed by the named Workers binding: `store: cf("X")`. */
export const cf =
  (binding: LimiterBinding) =>
  (window: RateLimitWindow): RateLimiter =>
    bindingRateLimiter(binding, window);

/**
 * A `key:` strategy that keys by the trusted client IP. `CF-Connecting-IP` is set by the edge and
 * cannot be spoofed, so it is the ONLY header we trust (never client-supplied `X-Forwarded-For`).
 */
export function clientKey({ req }: { readonly req: Request }): string {
  return trustedIpKey(req.headers.get("cf-connecting-ip"));
}
