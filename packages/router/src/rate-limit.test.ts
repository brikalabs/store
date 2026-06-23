import { describe, expect, test } from "bun:test";
import { HttpError } from "./errors";
import {
  FixedWindowRateLimiter,
  fallbackRateLimiter,
  normalizeIp,
  parseDuration,
  rateLimit,
  trustedIpKey,
} from "./rate-limit";
import type { MiddlewareInput } from "./router";

/**
 * A controllable clock so the window math is deterministic: `tick(ms)` advances
 * time without any real waiting.
 */
function fakeClock(start = 0) {
  let now = start;
  return { now: () => now, tick: (ms: number) => (now += ms) };
}

describe("FixedWindowRateLimiter", () => {
  test("allows requests up to the limit within a window", async () => {
    const limiter = new FixedWindowRateLimiter({ limit: 3, windowSeconds: 60 }, () => 0);
    for (let i = 0; i < 3; i++) {
      expect((await limiter.limit("k")).allowed).toBe(true);
    }
  });

  test("denies the request that exceeds the limit, with a retry hint", async () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 2, windowSeconds: 60 }, clock.now);
    await limiter.limit("k");
    await limiter.limit("k");

    clock.tick(10_000); // 10s into the 60s window
    const denied = await limiter.limit("k");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBe(50); // 60s window - 10s elapsed
  });

  test("resets once the window elapses", async () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowSeconds: 60 }, clock.now);
    expect((await limiter.limit("k")).allowed).toBe(true);
    expect((await limiter.limit("k")).allowed).toBe(false);

    clock.tick(60_000); // window fully elapsed
    expect((await limiter.limit("k")).allowed).toBe(true);
  });

  test("counts each key independently", async () => {
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowSeconds: 60 }, () => 0);
    expect((await limiter.limit("a")).allowed).toBe(true);
    expect((await limiter.limit("b")).allowed).toBe(true);
    expect((await limiter.limit("a")).allowed).toBe(false);
  });
});

describe("parseDuration", () => {
  test("parses seconds, minutes, hours", () => {
    expect(parseDuration("30s")).toBe(30);
    expect(parseDuration("5m")).toBe(300);
    expect(parseDuration("1h")).toBe(3600);
  });

  test("throws on a malformed duration", () => {
    // @ts-expect-error: invalid duration string, rejected at parse time.
    expect(() => parseDuration("1min")).toThrow();
  });

  test("rejects a non-positive or absurdly large window (overflow guard)", () => {
    expect(() => parseDuration("0s")).toThrow();
    expect(() => parseDuration("100000h")).toThrow(); // > 1 day
  });
});

describe("rateLimit middleware", () => {
  function input(tag = "ctx"): MiddlewareInput<{ tag: string }> {
    return {
      params: {},
      query: undefined,
      body: undefined,
      req: new Request("http://localhost/", { method: "POST" }),
      ctx: { tag },
      waitUntil: () => {},
    };
  }

  test("builds the limiter once and, once `max` is hit, throws 429 + Retry-After", async () => {
    const mw = rateLimit<{ tag: string }>({ max: 1, window: "1m", key: () => "k" });
    expect(await mw(input())).toBeUndefined();

    try {
      await mw(input());
      throw new Error("expected a 429");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(429);
      expect((error as HttpError).code).toBe("rate_limited");
      expect((error as HttpError).headers?.["retry-after"]).toBe("60");
    }
  });

  test("awaits an async key strategy, reading from ctx", async () => {
    const seen: string[] = [];
    const mw = rateLimit<{ tag: string }>({
      max: 5,
      window: "1m",
      key: async ({ ctx }) => {
        seen.push(ctx.tag);
        return ctx.tag;
      },
    });
    expect(await mw(input())).toBeUndefined();
    expect(seen).toEqual(["ctx"]);
  });

  test("uses a provided store factory, passing it the parsed window", async () => {
    let receivedWindow: { limit: number; windowSeconds: number } | undefined;
    const mw = rateLimit<{ tag: string }>({
      max: 5,
      window: "30s",
      key: () => "k",
      store: (window) => {
        receivedWindow = window;
        return new FixedWindowRateLimiter(window, () => 0);
      },
    });
    expect(await mw(input())).toBeUndefined();
    expect(receivedWindow).toEqual({ limit: 5, windowSeconds: 30 });
  });
});

describe("normalizeIp + trustedIpKey", () => {
  test("keeps IPv4 as-is and maps null/undefined to a shared bucket", () => {
    expect(normalizeIp("1.2.3.4")).toBe("1.2.3.4");
    expect(trustedIpKey("1.2.3.4")).toBe("1.2.3.4");
    expect(trustedIpKey(null)).toBe("unknown");
    expect(trustedIpKey(undefined)).toBe("unknown");
  });

  test("collapses IPv6 to its /64, canonicalizing case, zeros, and zone id", () => {
    expect(normalizeIp("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    const canonical = "2001:db8:0:0::/64";
    expect(normalizeIp("2001:db8::1")).toBe(canonical);
    expect(normalizeIp("2001:DB8::1")).toBe(canonical);
    expect(normalizeIp("2001:0db8::1")).toBe(canonical);
    expect(normalizeIp("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  test("keys an IPv4-mapped IPv6 address by its embedded IPv4", () => {
    expect(normalizeIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
  });
});

describe("fallbackRateLimiter", () => {
  test("uses the in-memory fallback when the probe is absent", async () => {
    const limiter = fallbackRateLimiter({ limit: 1, windowSeconds: 60 }, () => undefined);
    expect((await limiter.limit("a")).allowed).toBe(true);
    expect((await limiter.limit("a")).allowed).toBe(false);
    expect((await limiter.limit("b")).allowed).toBe(true); // separate key, own budget
  });

  test("honors the probe when present", async () => {
    const limiter = fallbackRateLimiter({ limit: 99, windowSeconds: 60 }, () => ({
      limit: ({ key }) => Promise.resolve({ success: key === "ok" }),
    }));
    expect((await limiter.limit("ok")).allowed).toBe(true);
    expect((await limiter.limit("no")).allowed).toBe(false);
  });

  test("fails OPEN to the fallback when the probe rejects", async () => {
    const limiter = fallbackRateLimiter({ limit: 1, windowSeconds: 60 }, () => ({
      limit: () => Promise.reject(new Error("binding down")),
    }));
    expect((await limiter.limit("a")).allowed).toBe(true);
    expect((await limiter.limit("a")).allowed).toBe(false); // fallback still enforces
  });
});
