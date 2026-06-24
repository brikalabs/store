import { beforeEach, describe, expect, test } from "bun:test";
import type { Db } from "../client";
import { regTokens } from "../schema";
import { makeAdapter, makeDb } from "../test-harness";
import { D1TokenStore } from "./token";

/**
 * D1 adapter tests for the publish-token store. The issue/verify happy path,
 * unknown-token, and prefix branches live in `apps/registry/src/auth.test.ts`;
 * these cover the remaining branches: expiry, revocation, and the one-way hash.
 */

/** Hash a token the same one-way way the adapter does, to seed rows directly. */
async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  let hex = "";
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

let db: Db;
let store: D1TokenStore;
beforeEach(() => {
  db = makeDb();
  store = makeAdapter(db, D1TokenStore);
});

describe("D1TokenStore", () => {
  test("verify returns null for an expired token", async () => {
    const token = "brika_expired";
    const past = Math.floor(Date.now() / 1000) - 60;
    await db
      .insert(regTokens)
      .values({ tokenHash: await hashToken(token), userId: "octocat", expiresAt: past });
    expect(await store.verify(token)).toBeNull();
  });

  test("revoke deletes the row, so a later verify returns null", async () => {
    const token = await store.issue("octocat");
    expect(await store.verify(token)).toEqual({ userId: "octocat" });
    await store.revoke(token);
    expect(await store.verify(token)).toBeNull();
  });

  test("revoke resolves without throwing for an unknown token", async () => {
    await expect(store.revoke("brika_never-issued")).resolves.toBeUndefined();
  });

  test("stores a hash that differs from the issued token (one-way property)", async () => {
    const token = await store.issue("octocat");
    const rows = await db.select().from(regTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(rows[0]?.tokenHash).toBe(await hashToken(token));
  });
});
