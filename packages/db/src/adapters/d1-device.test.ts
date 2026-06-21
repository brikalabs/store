import { beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { regDeviceAuth } from "../schema";
import { makeDb } from "../test-harness";
import { D1DeviceStore } from "./d1-device";

/**
 * Unit tests for the D1-backed device grant store against a real in-memory
 * SQLite, asserting the persisted rows directly so every method is exercised.
 */

let db: Db;
beforeEach(() => {
  db = makeDb();
});

describe("D1DeviceStore", () => {
  test("create inserts a pending grant (unapproved, no login)", async () => {
    const store = new D1DeviceStore(db);
    await store.create({ deviceCode: "dev-1", userCode: "ABCD-1234", expiresAt: 1000 });

    const rows = await db.select().from(regDeviceAuth).where(eq(regDeviceAuth.deviceCode, "dev-1"));
    const row = rows[0];
    expect(row).toBeDefined();
    expect(row?.userCode).toBe("ABCD-1234");
    expect(row?.expiresAt).toBe(1000);
    expect(row?.approved).toBe(false);
    expect(row?.userId).toBeNull();
  });

  test("find returns null for an unknown device code", async () => {
    const store = new D1DeviceStore(db);
    expect(await store.find("missing")).toBeNull();
  });

  test("find returns the full grant for a created device code", async () => {
    const store = new D1DeviceStore(db);
    await store.create({ deviceCode: "dev-2", userCode: "WXYZ-9876", expiresAt: 2000 });

    const grant = await store.find("dev-2");
    expect(grant).toEqual({
      deviceCode: "dev-2",
      userCode: "WXYZ-9876",
      userId: null,
      approved: false,
      expiresAt: 2000,
    });
  });

  test("find reflects an approval written out of band (login + approved)", async () => {
    const store = new D1DeviceStore(db);
    await store.create({ deviceCode: "dev-3", userCode: "MNOP-5555", expiresAt: 3000 });
    await db
      .update(regDeviceAuth)
      .set({ approved: true, userId: "octocat" })
      .where(eq(regDeviceAuth.deviceCode, "dev-3"));

    const grant = await store.find("dev-3");
    expect(grant?.approved).toBe(true);
    expect(grant?.userId).toBe("octocat");
  });

  test("remove deletes the grant; a later find returns null", async () => {
    const store = new D1DeviceStore(db);
    await store.create({ deviceCode: "dev-4", userCode: "QRST-0000", expiresAt: 4000 });
    await store.remove("dev-4");

    expect(await store.find("dev-4")).toBeNull();
    expect(await db.select().from(regDeviceAuth)).toHaveLength(0);
  });

  test("remove is a no-op for an unknown device code", async () => {
    const store = new D1DeviceStore(db);
    await store.create({ deviceCode: "dev-5", userCode: "UVWX-1111", expiresAt: 5000 });
    await store.remove("not-there");

    expect(await db.select().from(regDeviceAuth)).toHaveLength(1);
  });
});
