import { beforeEach, describe, expect, mock, test } from "bun:test";
import { HttpError } from "@brika/router";
import { type Db, regDeviceAuth, regTokens } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { buildServices, type Services } from "../services";
import { fakeR2, makeDb } from "../test-harness";

/**
 * Integration tests for the device-authorization HTTP handlers against the real
 * in-memory DB. `cloudflare:workers` is stubbed so `vars().STORE_URL` (read by
 * `handleDeviceCode` to build the verification URL) resolves without the Worker
 * runtime.
 */

mock.module("cloudflare:workers", () => ({ env: { STORE_URL: "http://localhost:3000/" } }));

const { handleDeviceCode, handleDeviceToken, handleRevoke } = await import("./device");

function services(db: Db): Services {
  return buildServices(db, fakeR2(), "http://localhost:8787");
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
    const res = await handleDeviceCode(services(db));
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

describe("handleDeviceToken", () => {
  test("400 invalid_request when the body is missing device_code", async () => {
    expect(await statusOf(handleDeviceToken(tokenRequest({}), services(db)))).toBe(400);
  });

  test("400 invalid_request when the body is not valid JSON", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(await statusOf(handleDeviceToken(req, services(db)))).toBe(400);
  });

  test("400 (authorization_pending) when the grant exists but is not approved", async () => {
    const ctx = services(db);
    const issued = await ctx.devices.requestCode();
    await expect(
      handleDeviceToken(tokenRequest({ device_code: issued.deviceCode }), ctx),
    ).rejects.toMatchObject({ status: 400, message: "authorization_pending" });
  });

  test("issues a publish token once the grant is approved, consuming the grant", async () => {
    const ctx = services(db);
    const issued = await ctx.devices.requestCode();
    await db
      .update(regDeviceAuth)
      .set({ approved: true, githubLogin: "octocat" })
      .where(eq(regDeviceAuth.deviceCode, issued.deviceCode));

    const res = await handleDeviceToken(tokenRequest({ device_code: issued.deviceCode }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token_type).toBe("bearer");
    expect(body.github_login).toBe("octocat");
    expect(body.access_token).toMatch(/^brika_/);

    // The token was persisted and the grant consumed.
    expect(await db.select().from(regTokens)).toHaveLength(1);
    expect(await db.select().from(regDeviceAuth)).toHaveLength(0);
  });
});

describe("handleRevoke", () => {
  test("401 when there is no Bearer authorization header", async () => {
    const req = new Request("http://localhost/", { method: "POST" });
    expect(await statusOf(handleRevoke(req, services(db)))).toBe(401);
  });

  test("revokes the presented token and returns ok", async () => {
    const ctx = services(db);
    // Mint a token via the device flow so a row exists to revoke.
    const issued = await ctx.devices.requestCode();
    await db
      .update(regDeviceAuth)
      .set({ approved: true, githubLogin: "octocat" })
      .where(eq(regDeviceAuth.deviceCode, issued.deviceCode));
    const tokenBody = await (
      await handleDeviceToken(tokenRequest({ device_code: issued.deviceCode }), ctx)
    ).json();

    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenBody.access_token}` },
    });
    const res = await handleRevoke(req, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await db.select().from(regTokens)).toHaveLength(0);
  });

  test("is idempotent: revoking an unknown token still returns ok", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { authorization: "Bearer brika_unknown" },
    });
    const res = await handleRevoke(req, services(db));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
