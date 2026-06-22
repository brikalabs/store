import { env } from "cloudflare:workers";
import { FixedWindowRateLimiter, type RateLimiter, type RateLimitWindow } from "@brika/router";

/** The shape of a Cloudflare Workers rate-limit binding (`env.MY_LIMITER`). */
export interface CfRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Names of the rate-limit bindings declared in `wrangler.jsonc` (the `*_LIMITER` ones). */
type LimiterBinding = `${string}_LIMITER` & keyof Cloudflare.Env;

/**
 * A {@link RateLimiter} over the named Workers binding, with a per-instance in-memory
 * fallback when unbound (local dev, tests). If the binding call errors we fail OPEN to
 * the fallback rather than 500 a publish/login on infrastructure noise.
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
 * A `key:` strategy that keys by the trusted client IP. `CF-Connecting-IP` is set by
 * the edge and cannot be spoofed, so it is the ONLY header we trust (never client-supplied
 * `X-Forwarded-For`, which an attacker could rotate to mint fresh keys).
 */
export function clientKey({ req }: { readonly req: Request }): string {
  const ip = req.headers.get("cf-connecting-ip");
  return ip === null ? "unknown" : normalizeIp(ip);
}

/**
 * Canonicalize a client IP into a stable rate-limit key. IPv6 is keyed by its /64
 * (a client typically owns a whole /64, so keying the full address lets it walk its range);
 * canonicalizing spellings stops two forms of one address minting distinct keys.
 */
function normalizeIp(ip: string): string {
  const address = (ip.split("%")[0] ?? "").toLowerCase();
  if (!address.includes(":")) return address; // plain IPv4
  const mappedV4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address); // ::ffff:1.2.3.4 -> 1.2.3.4
  if (mappedV4 !== null) return mappedV4[1] as string;

  // Expand the `::` zero-run to eight groups, then keep the /64 (first four).
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
