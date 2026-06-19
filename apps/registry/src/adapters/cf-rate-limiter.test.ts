import { describe, expect, mock, test } from "bun:test";

// The adapter imports the ambient `env`; stub it (no bindings) so the in-memory
// fallback path is exercised. The bound path is covered end-to-end (with a fake
// binding) in `controllers/device.test.ts`.
mock.module("cloudflare:workers", () => ({ env: {} }));

const { clientKey, bindingRateLimiter, cf } = await import("./cf-rate-limiter");

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/", { method: "POST", headers });
}

describe("clientKey", () => {
  test("keys by the unspoofable CF-Connecting-IP", () => {
    expect(clientKey({ req: req({ "cf-connecting-ip": "1.2.3.4" }) })).toBe("1.2.3.4");
  });

  test("ignores client-supplied X-Forwarded-For (spoofable) -> shared 'unknown' bucket", () => {
    expect(clientKey({ req: req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }) })).toBe("unknown");
    expect(clientKey({ req: req() })).toBe("unknown");
  });

  test("collapses an IPv6 address to its /64 so a client can't walk its own range", () => {
    expect(clientKey({ req: req({ "cf-connecting-ip": "2001:db8:1:2:3:4:5:6" }) })).toBe(
      "2001:db8:1:2::/64",
    );
    // The :: zero-run is expanded before taking the first four groups.
    expect(clientKey({ req: req({ "cf-connecting-ip": "2001:db8::1" }) })).toBe(
      "2001:db8:0:0::/64",
    );
  });

  test("canonicalizes case and leading zeros so one /64 has exactly one key", () => {
    const canonical = "2001:db8:0:0::/64";
    expect(clientKey({ req: req({ "cf-connecting-ip": "2001:db8::1" }) })).toBe(canonical);
    expect(clientKey({ req: req({ "cf-connecting-ip": "2001:DB8::1" }) })).toBe(canonical);
    expect(clientKey({ req: req({ "cf-connecting-ip": "2001:0db8::1" }) })).toBe(canonical);
  });

  test("keys an IPv4-mapped IPv6 address by its embedded IPv4, not one shared bucket", () => {
    expect(clientKey({ req: req({ "cf-connecting-ip": "::ffff:1.2.3.4" }) })).toBe("1.2.3.4");
    expect(clientKey({ req: req({ "cf-connecting-ip": "::ffff:5.6.7.8" }) })).toBe("5.6.7.8");
  });

  test("strips an IPv6 zone id", () => {
    expect(clientKey({ req: req({ "cf-connecting-ip": "fe80::1%eth0" }) })).toBe("fe80:0:0:0::/64");
  });
});

describe("bindingRateLimiter (binding absent -> in-memory fallback)", () => {
  test("enforces the window per key when no Workers binding is bound", async () => {
    const limiter = bindingRateLimiter("DEVICE_LIMITER", { limit: 1, windowSeconds: 60 });
    expect((await limiter.limit("a")).allowed).toBe(true);
    expect((await limiter.limit("a")).allowed).toBe(false);
    // A different key keeps its own budget.
    expect((await limiter.limit("b")).allowed).toBe(true);
  });

  test("cf(name) builds the same fallback limiter from a window", async () => {
    const limiter = cf("DEVICE_LIMITER")({ limit: 1, windowSeconds: 60 });
    expect((await limiter.limit("k")).allowed).toBe(true);
    expect((await limiter.limit("k")).allowed).toBe(false);
  });
});
