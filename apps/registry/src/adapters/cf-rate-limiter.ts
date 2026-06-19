import { env } from "cloudflare:workers";
import { FixedWindowRateLimiter, type RateLimiter, type RateLimitWindow } from "@brika/router";

/**
 * The Cloudflare side of rate limiting: an adapter for the router's `RateLimiter`
 * port over a Workers rate-limit binding, plus the helpers a controller needs to
 * declare its own limit inline (no central config). This is the only place a
 * rate-limit binding is touched; swapping Cloudflare means another `RateLimiter`.
 */

/**
 * The shape of a Cloudflare Workers rate-limit binding (`env.MY_LIMITER`). Mirrors
 * the `RateLimit` interface that `wrangler types` generates for the binding; we
 * hand-declare it (in env.ts) because this repo hand-rolls `Cloudflare.Env` rather
 * than committing the generated `worker-configuration.d.ts` (which is gitignored).
 */
export interface CfRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Names of the rate-limit bindings declared in `wrangler.jsonc` (the `*_LIMITER` ones). */
type LimiterBinding = `${string}_LIMITER` & keyof Cloudflare.Env;

/**
 * A {@link RateLimiter} backed by the named Workers binding, resolved lazily per
 * call (safe to construct at module load): the distributed binding when bound, else
 * a per-instance in-memory fallback (local dev, tests, a non-Cloudflare host). The
 * binding enforces its own window; on a denial we report the configured window as
 * the `Retry-After` hint (the binding returns only `{ success }`). If the binding
 * call itself errors (backend hiccup), we fail OPEN to the in-memory fallback rather
 * than 500 a publish/login on infrastructure noise.
 */
export function bindingRateLimiter(binding: LimiterBinding, window: RateLimitWindow): RateLimiter {
  const fallback = new FixedWindowRateLimiter(window);
  return {
    async limit(key) {
      const bound = env[binding];
      if (bound === undefined) return fallback.limit(key);
      try {
        const { success } = await bound.limit({ key });
        return success
          ? { allowed: true }
          : { allowed: false, retryAfterSeconds: window.windowSeconds };
      } catch {
        return fallback.limit(key);
      }
    },
  };
}

/** A `store:` factory for `rateLimit`, backed by the named Workers binding: `store: cf("X")`. */
export const cf =
  (binding: LimiterBinding) =>
  (window: RateLimitWindow): RateLimiter =>
    bindingRateLimiter(binding, window);

/**
 * A `key:` strategy that keys by the trusted client IP. Behind Cloudflare,
 * `CF-Connecting-IP` is set by the edge and cannot be spoofed, so it is the ONLY
 * header we trust (never the client-supplied `X-Forwarded-For`, which an attacker
 * could rotate to mint fresh keys). IPv6 is collapsed to its /64 so a client cannot
 * walk its own range. IP-less requests (only reachable off Cloudflare) share one bucket.
 */
export function clientKey({ req }: { readonly req: Request }): string {
  const ip = req.headers.get("cf-connecting-ip");
  return ip === null ? "unknown" : normalizeIp(ip);
}

/**
 * Canonicalize a client IP into a stable rate-limit key. IPv4 is keyed whole. IPv6
 * is keyed by its /64 network (a client typically owns a whole /64, so keying the
 * full address would let it walk its range). Canonicalization is the point: lowercase
 * and strip a zone id + per-group leading zeros so two spellings of the same address
 * (`2001:DB8::1`, `2001:0db8::1`) cannot mint distinct keys; an IPv4-mapped address
 * (`::ffff:1.2.3.4`) is keyed by its embedded IPv4, not collapsed into one bucket.
 */
function normalizeIp(ip: string): string {
  const address = (ip.split("%")[0] ?? "").toLowerCase();
  if (!address.includes(":")) return address; // plain IPv4
  const mappedV4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address); // ::ffff:1.2.3.4 -> 1.2.3.4
  if (mappedV4 !== null) return mappedV4[1] as string;

  // Expand the `::` zero-run to eight groups, then keep the /64 (first four),
  // each group's leading zeros stripped for a canonical form.
  const [head = "", tail = ""] = address.split("::");
  const headGroups = head === "" ? [] : head.split(":");
  const tailGroups = tail === "" ? [] : tail.split(":");
  const zeros = Array.from(
    { length: Math.max(0, 8 - headGroups.length - tailGroups.length) },
    () => "0",
  );
  const prefix = [...headGroups, ...zeros, ...tailGroups]
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""));
  return `${prefix.join(":")}::/64`;
}
