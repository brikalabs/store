import { z } from "zod";
import { tooManyRequests } from "./errors";
import type { Middleware, MiddlewareInput } from "./router";

/**
 * Generic, transport-agnostic rate limiting: a {@link RateLimiter} port, a pure in-memory default
 * ({@link FixedWindowRateLimiter}), and the {@link rateLimit} middleware that enforces it on a route.
 */

/** The outcome of a rate-limit check for one key. */
export interface RateLimitResult {
  /** Whether this request may proceed now. */
  readonly allowed: boolean;
  /** When denied, a hint (seconds) until the window resets, for `Retry-After`. */
  readonly retryAfterSeconds?: number;
}

/** A rate limiter keyed by an opaque string (an IP, a token hash, `owner/repo`, …). */
export interface RateLimiter {
  /** Account for one request against `key` and report whether it is allowed. */
  limit(key: string): Promise<RateLimitResult>;
}

/** A fixed-window quota: at most `limit` requests per `windowSeconds`. */
export interface RateLimitWindow {
  readonly limit: number;
  readonly windowSeconds: number;
}

interface WindowState {
  /** Epoch ms the current window started at. */
  windowStart: number;
  /** Requests counted in the current window. */
  count: number;
}

/**
 * A pure, in-memory fixed-window rate limiter (injected clock for deterministic tests). In-process
 * state limits per isolate, not globally; a distributed deployment supplies its own {@link RateLimiter}.
 *
 * Counters are reset lazily on the next request, so entries for keys never seen again persist for the
 * isolate's lifetime: fine for bounded key spaces (a /64 prefix, a principal), but not a fit for an
 * adversarial unbounded-key workload as a standalone production limiter.
 */
export class FixedWindowRateLimiter implements RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;
  readonly #counters = new Map<string, WindowState>();

  constructor(window: RateLimitWindow, now: () => number = Date.now) {
    this.#limit = window.limit;
    this.#windowMs = window.windowSeconds * 1000;
    this.#now = now;
  }

  limit(key: string): Promise<RateLimitResult> {
    const now = this.#now();
    const state = this.#counters.get(key);

    // First request for this key, or its window has fully elapsed: open a fresh one.
    if (state === undefined || now - state.windowStart >= this.#windowMs) {
      this.#counters.set(key, { windowStart: now, count: 1 });
      return Promise.resolve({ allowed: true });
    }

    if (state.count < this.#limit) {
      state.count += 1;
      return Promise.resolve({ allowed: true });
    }

    const retryAfterSeconds = Math.ceil((state.windowStart + this.#windowMs - now) / 1000);
    return Promise.resolve({ allowed: false, retryAfterSeconds });
  }
}

/** A backend rate-limit probe (e.g. a Cloudflare Workers rate-limit binding). Structural, so the
 *  router never depends on a platform type. */
export interface RateLimitProbe {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * A {@link RateLimiter} over a backend `probe` (read lazily via a thunk, so the app's env seam stays
 * out of the router), failing OPEN to a per-isolate {@link FixedWindowRateLimiter} when the probe is
 * absent (unbound) or rejects (infra noise): a transient backend fault never blocks a real request.
 * The fallback is built once, so its window persists across calls.
 */
export function fallbackRateLimiter(
  window: RateLimitWindow,
  probe: () => RateLimitProbe | undefined,
): RateLimiter {
  const fallback = new FixedWindowRateLimiter(window);
  return {
    async limit(key) {
      const bound = probe();
      if (bound === undefined) return fallback.limit(key);
      const success = await bound.limit({ key }).then(
        (r) => r.success,
        () => null,
      );
      if (success === null) return fallback.limit(key); // probe faulted
      return success
        ? { allowed: true }
        : { allowed: false, retryAfterSeconds: window.windowSeconds };
    },
  };
}

/**
 * Canonicalize a client IP into a stable rate-limit key. IPv6 is keyed by its /64 (a client
 * typically owns a whole /64, so keying the full address lets it walk its range); canonicalizing
 * spellings stops two forms of one address minting distinct keys.
 */
export function normalizeIp(ip: string): string {
  const address = (ip.split("%")[0] ?? "").toLowerCase();
  if (!address.includes(":")) return address; // plain IPv4
  const mappedV4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address); // ::ffff:1.2.3.4 -> 1.2.3.4
  if (mappedV4 !== null) return mappedV4[1] ?? address;

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

/** The trusted client IP as a stable rate-limit key, or `"unknown"`. Pass the unspoofable edge IP
 *  (e.g. `CF-Connecting-IP`); never a client-supplied header an attacker can rotate. */
export function trustedIpKey(ip: string | null | undefined): string {
  return ip === null || ip === undefined ? "unknown" : normalizeIp(ip);
}

/** A duration string for a rate-limit window: `"30s"`, `"5m"`, `"1h"`. */
export type Duration = `${number}${"s" | "m" | "h"}`;

const UNIT_SECONDS = { s: 1, m: 60, h: 3600 } as const;
/** Cap windows at a day: anything larger is a typo, and guards against overflow. */
const MAX_WINDOW_SECONDS = 86_400;

/** Zod schema for a {@link Duration}: validates `<int><unit>` and converts to seconds. */
const durationSchema = z.string().transform((value, ctx) => {
  const match = /^(\d+)([smh])$/.exec(value);
  const seconds = match
    ? Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS]
    : 0;
  if (seconds <= 0 || seconds > MAX_WINDOW_SECONDS) {
    ctx.addIssue({ code: "custom", message: `use a duration like "30s", "5m", "1h"` });
    return z.NEVER;
  }
  return seconds;
});

/** Parse a {@link Duration} into seconds. Throws (at load time) on a malformed string. */
export function parseDuration(duration: Duration): number {
  return durationSchema.parse(duration);
}

/** Derive a rate-limit key from the request inputs (an IP, a principal, …). */
export type RateLimitKey<Ctx> = (input: MiddlewareInput<Ctx>) => string | Promise<string>;

/** How a route declares its rate limit. */
export interface RateLimitConfig<Ctx> {
  /** Max requests allowed per window. */
  readonly max: number;
  /** Window as a duration string (`"30s"`, `"5m"`, `"1h"`). */
  readonly window: Duration;
  /** Derive the rate-limit key from the request (an IP, a principal, …). */
  readonly key: RateLimitKey<Ctx>;
  /** Optional backend built from the window. Defaults to a per-isolate {@link FixedWindowRateLimiter}. */
  readonly store?: (window: RateLimitWindow) => RateLimiter;
  /** Optional 429 message (defaults to "Too many requests"). */
  readonly message?: string;
}

/**
 * Middleware that rate-limits a route, throwing `429` (with `Retry-After`) when the key's window is
 * exhausted. The limiter is built ONCE here (route-definition time), so its window persists across requests.
 */
export function rateLimit<Ctx>(config: RateLimitConfig<Ctx>): Middleware<Ctx> {
  const window = { limit: config.max, windowSeconds: parseDuration(config.window) };
  const limiter = config.store?.(window) ?? new FixedWindowRateLimiter(window);
  return async (input) => {
    const { allowed, retryAfterSeconds } = await limiter.limit(await config.key(input));
    if (!allowed) throw tooManyRequests(config.message ?? "Too many requests", retryAfterSeconds);
  };
}
