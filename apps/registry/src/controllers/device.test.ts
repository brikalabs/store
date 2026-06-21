import { beforeEach, describe, expect, mock, test } from "bun:test";
import { inject, type Provider, runInContext } from "@brika/di";
import { DeviceService } from "@brika/registry-core";
import { HttpError } from "@brika/router";
import { type Db, regDeviceAuth, regTokens } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { mount } from "../http/router";
import { provideRegistry } from "../services";
import { fakeR2, makeDb } from "../test-harness";

/**
 * Integration tests for the device-authorization HTTP handlers against the real
 * in-memory DB. `cloudflare:workers` is stubbed so `vars().STORE_URL` (read by
 * `handleDeviceCode`) resolves, and a fake limit-1 `DEVICE_LIMITER` binding stands
 * in for the Workers rate-limit binding the `rateLimit` middleware reads.
 */

mock.module("cloudflare:workers", () => {
  // A per-key limit-1 fake of the Workers rate-limit binding: the second request
  // for a given key is denied. State persists across the file (tests use distinct IPs).
  const counts = new Map<string, number>();
  return {
    env: {
      STORE_URL: "http://localhost:3000/",
      DEVICE_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          const next = (counts.get(key) ?? 0) + 1;
          counts.set(key, next);
          return { success: next <= 1 };
        },
      },
    },
  };
});

const { handleDeviceCode, handleDeviceToken, handleRevoke, handleWhoami, deviceController } =
  await import("./device");

function services(db: Db): Provider[] {
  return provideRegistry({ db, tarballs: fakeR2(), baseUrl: "http://localhost:8787" });
}

/**
 * Run a handler inside the per-request injection context the `mount({ around })` wrapper
 * would establish in production, so its `inject(...)` calls resolve.
 */
function run<T>(providers: Provider[], fn: () => Promise<T>): Promise<T> {
  return runInContext(providers, fn);
}

function tokenRequest(body: unknown): Request {
  return new Request("http://localhost/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The status a handler yields, whether it returns a Response or throws an HttpError. */
async function statusOf(run: Promise<Response>): Promise<number> {
  try {
    return (await run).status;
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

let db: Db;
beforeEach(() => {
  db = makeDb();
});

describe("handleDeviceCode", () => {
  test("issues a grant and returns the verification URLs (trailing slash trimmed)", async () => {
    const res = await run(services(db), () => handleDeviceCode());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.verification_uri).toBe("http://localhost:3000/device");
    expect(body.verification_uri_complete).toBe(
      `http://localhost:3000/device?code=${body.user_code}`,
    );
    expect(typeof body.device_code).toBe("string");
    expect(body.interval).toBeGreaterThan(0);
    expect(body.expires_in).toBeGreaterThan(0);

    // The grant was persisted as pending.
    const rows = await db.select().from(regDeviceAuth);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deviceCode).toBe(body.device_code);
  });
});

describe("device-code rate limiting (declared via route middleware)", () => {
  /** Mount the real device controller; the limiter comes from the mocked binding. */
  function mountedApp(): Hono {
    const app = new Hono();
    // The handlers resolve their deps via `inject(...)`, so the per-request graph is supplied
    // through the same `around` injection-context wrapper the worker uses (not a `ctx` factory).
    mount(app, [deviceController], {
      around: (_c, exec) => runInContext(services(db), exec),
    });
    return app;
  }

  const execCtx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
  const post = (app: Hono, ip: string) =>
    app.request(
      "/-/device/code",
      { method: "POST", headers: { "cf-connecting-ip": ip } },
      {},
      execCtx,
    );

  test("the route's rateLimit middleware returns 429 once the window is exhausted", async () => {
    const app = mountedApp();
    expect((await post(app, "1.2.3.4")).status).toBe(200);

    const limited = await post(app, "1.2.3.4");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(await limited.json()).toMatchObject({ code: "rate_limited" });
  });

  test("a different IP keeps its own budget", async () => {
    const app = mountedApp();
    expect((await post(app, "1.1.1.1")).status).toBe(200);
    expect((await post(app, "2.2.2.2")).status).toBe(200);
  });
});

describe("handleDeviceToken", () => {
  test("400 invalid_request when the body is missing device_code", async () => {
    expect(await statusOf(run(services(db), () => handleDeviceToken(tokenRequest({}))))).toBe(400);
  });

  test("400 invalid_request when the body is not valid JSON", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(await statusOf(run(services(db), () => handleDeviceToken(req)))).toBe(400);
  });

  test("400 (authorization_pending) when the grant exists but is not approved", async () => {
    const ctx = services(db);
    const issued = await run(ctx, () => inject(DeviceService).requestCode());
    await expect(
      run(ctx, () => handleDeviceToken(tokenRequest({ device_code: issued.deviceCode }))),
    ).rejects.toMatchObject({ status: 400, message: "authorization_pending" });
  });

  test("issues a publish token once the grant is approved, consuming the grant", async () => {
    const ctx = services(db);
    const issued = await run(ctx, () => inject(DeviceService).requestCode());
    await db
      .update(regDeviceAuth)
      .set({ approved: true, githubLogin: "octocat" })
      .where(eq(regDeviceAuth.deviceCode, issued.deviceCode));

    const res = await run(ctx, () =>
      handleDeviceToken(tokenRequest({ device_code: issued.deviceCode })),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token_type).toBe("bearer");
    expect(body.github_login).toBe("octocat");
    expect(body.access_token).toMatch(/^brika_/);
    // No store `users` row in this harness, so the display name resolves to null and the
    // CLI falls back to the github login.
    expect(body.display_name).toBeNull();

    // The token was persisted and the grant consumed.
    expect(await db.select().from(regTokens)).toHaveLength(1);
    expect(await db.select().from(regDeviceAuth)).toHaveLength(0);
  });
});

describe("handleWhoami", () => {
  test("401 when there is no Bearer authorization header", async () => {
    const req = new Request("http://localhost/", { method: "GET" });
    expect(await statusOf(run(services(db), () => handleWhoami(req)))).toBe(401);
  });

  test("returns the token's github login + display name (null without a store user)", async () => {
    const ctx = services(db);
    const issued = await run(ctx, () => inject(DeviceService).requestCode());
    await db
      .update(regDeviceAuth)
      .set({ approved: true, githubLogin: "octocat" })
      .where(eq(regDeviceAuth.deviceCode, issued.deviceCode));
    const tokenBody = await (
      await run(ctx, () => handleDeviceToken(tokenRequest({ device_code: issued.deviceCode })))
    ).json();

    const req = new Request("http://localhost/", {
      method: "GET",
      headers: { authorization: `Bearer ${tokenBody.access_token}` },
    });
    const res = await run(ctx, () => handleWhoami(req));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.github_login).toBe("octocat");
    // No store `users` row in this harness, so the display name resolves to null.
    expect(body.display_name).toBeNull();
  });
});

describe("handleRevoke", () => {
  test("401 when there is no Bearer authorization header", async () => {
    const req = new Request("http://localhost/", { method: "POST" });
    expect(await statusOf(run(services(db), () => handleRevoke(req)))).toBe(401);
  });

  test("revokes the presented token and returns ok", async () => {
    const ctx = services(db);
    // Mint a token via the device flow so a row exists to revoke.
    const issued = await run(ctx, () => inject(DeviceService).requestCode());
    await db
      .update(regDeviceAuth)
      .set({ approved: true, githubLogin: "octocat" })
      .where(eq(regDeviceAuth.deviceCode, issued.deviceCode));
    const tokenBody = await (
      await run(ctx, () => handleDeviceToken(tokenRequest({ device_code: issued.deviceCode })))
    ).json();

    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenBody.access_token}` },
    });
    const res = await run(ctx, () => handleRevoke(req));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await db.select().from(regTokens)).toHaveLength(0);
  });

  test("is idempotent: revoking an unknown token still returns ok", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { authorization: "Bearer brika_unknown" },
    });
    const res = await run(services(db), () => handleRevoke(req));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
