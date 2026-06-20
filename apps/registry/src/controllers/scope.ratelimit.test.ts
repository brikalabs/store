import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Db } from "@brika/store-db";
import { issueToken } from "@brika/store-db/adapters";
import { Hono } from "hono";
import { mount } from "../http/router";
import { buildServices, type Services } from "../services";
import { fakeR2, makeDb } from "../test-harness";

/**
 * Integration test for the claim rate limit (ORG-004), mirroring the device-code
 * limiter test: a limit-1 fake of the Workers rate-limit binding stands in for
 * CLAIM_LIMITER, so the second claim from the same principal is denied at the
 * middleware (before the handler/cap). State persists across the file; tests use
 * distinct principals.
 */
mock.module("cloudflare:workers", () => {
  const counts = new Map<string, number>();
  return {
    env: {
      CLAIM_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          const next = (counts.get(key) ?? 0) + 1;
          counts.set(key, next);
          return { success: next <= 1 };
        },
      },
    },
  };
});

const { scopeController } = await import("./scope");

function services(db: Db): Services {
  return buildServices(db, fakeR2(), "http://localhost:8787");
}

let db: Db;
beforeEach(() => {
  db = makeDb();
});

describe("claim rate limiting (declared via route middleware)", () => {
  function mountedApp(): Hono {
    const app = new Hono();
    mount(app, [scopeController], { context: () => services(db) });
    return app;
  }

  const execCtx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
  const claim = (app: Hono, scope: string, token: string) =>
    app.request(
      `/-/scope/${encodeURIComponent(scope)}`,
      { method: "PUT", headers: { authorization: `Bearer ${token}` } },
      {},
      execCtx,
    );

  test("ORG-004-AC1: the route's rateLimit middleware returns 429 once exhausted", async () => {
    const app = mountedApp();
    const token = await issueToken(db, "alice");

    expect((await claim(app, "@first", token)).status).toBe(201);

    const limited = await claim(app, "@second", token);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(await limited.json()).toMatchObject({ code: "rate_limited" });
  });

  test("a different principal keeps its own budget", async () => {
    const app = mountedApp();
    const alice = await issueToken(db, "alice2");
    const bob = await issueToken(db, "bob2");
    expect((await claim(app, "@alpha", alice)).status).toBe(201);
    expect((await claim(app, "@bravo", bob)).status).toBe(201);
  });
});
