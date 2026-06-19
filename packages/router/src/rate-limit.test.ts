import { describe, expect, test } from "bun:test";
import { HttpError } from "./errors";
import { FixedWindowRateLimiter, parseDuration, rateLimit } from "./rate-limit";
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
