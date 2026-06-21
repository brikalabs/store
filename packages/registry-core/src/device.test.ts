import { describe, expect, test } from "bun:test";
import { type DeviceGrant, DeviceService, type DeviceStore } from "./device";

/** In-memory DeviceStore for deterministic tests (no D1, no network). */
function fakeStore(seed: DeviceGrant[] = []): DeviceStore & { grants: Map<string, DeviceGrant> } {
  const grants = new Map(seed.map((g) => [g.deviceCode, g]));
  return {
    grants,
    async create(grant) {
      grants.set(grant.deviceCode, { ...grant, userId: null, approved: false });
    },
    async find(deviceCode) {
      return grants.get(deviceCode) ?? null;
    },
    async remove(deviceCode) {
      grants.delete(deviceCode);
    },
  };
}

const FIXED_NOW = 1_000_000;
const options = {
  now: () => FIXED_NOW,
  deviceCode: () => "device-1",
  userCode: () => "BCDF-GHJK",
  ttlSeconds: 900,
  pollIntervalSeconds: 5,
};

describe("DeviceService.requestCode", () => {
  test("stores a pending grant with the injected codes and TTL", async () => {
    const store = fakeStore();
    const code = await new DeviceService(store, options).requestCode();
    expect(code).toEqual({
      deviceCode: "device-1",
      userCode: "BCDF-GHJK",
      expiresInSeconds: 900,
      intervalSeconds: 5,
    });
    const stored = store.grants.get("device-1");
    expect(stored?.expiresAt).toBe(FIXED_NOW + 900);
    expect(stored?.approved).toBe(false);
  });
});

describe("DeviceService.redeem", () => {
  test("invalid_grant for an unknown device code", async () => {
    const result = await new DeviceService(fakeStore(), options).redeem("nope");
    expect(result).toEqual({ ok: false, error: "invalid_grant" });
  });

  test("authorization_pending while unapproved", async () => {
    const store = fakeStore([
      {
        deviceCode: "d",
        userCode: "u",
        userId: null,
        approved: false,
        expiresAt: FIXED_NOW + 60,
      },
    ]);
    const result = await new DeviceService(store, options).redeem("d");
    expect(result).toEqual({ ok: false, error: "authorization_pending" });
    // The grant is kept so the CLI can keep polling.
    expect(store.grants.has("d")).toBe(true);
  });

  test("expired_token deletes the grant", async () => {
    const store = fakeStore([
      {
        deviceCode: "d",
        userCode: "u",
        userId: "octocat",
        approved: true,
        expiresAt: FIXED_NOW - 1,
      },
    ]);
    const result = await new DeviceService(store, options).redeem("d");
    expect(result).toEqual({ ok: false, error: "expired_token" });
    expect(store.grants.has("d")).toBe(false);
  });

  test("returns the login and consumes the grant once approved", async () => {
    const store = fakeStore([
      {
        deviceCode: "d",
        userCode: "u",
        userId: "octocat",
        approved: true,
        expiresAt: FIXED_NOW + 60,
      },
    ]);
    const result = await new DeviceService(store, options).redeem("d");
    expect(result).toEqual({ ok: true, userId: "octocat" });
    expect(store.grants.has("d")).toBe(false);
  });
});
