import { describe, expect, test } from "bun:test";
import { type DeviceGrant, DeviceService, type DeviceStore } from "./device";

/**
 * Covers the default code generators (random UUID device code, two no-vowel
 * four-character user-code groups) and the default TTL / poll interval, which the
 * existing device.test.ts skips by injecting deterministic generators.
 */

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

const VOWELS_AND_AMBIGUOUS = /[AEIOU01]/;

describe("DeviceService default generators", () => {
  test("requestCode mints a UUID device code and a readable user code", async () => {
    const store = fakeStore();
    const code = await new DeviceService(store).requestCode();

    // Device code defaults to a random UUID.
    expect(code.deviceCode).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // User code defaults to two four-character groups joined by a dash, drawn from a
    // vowel-free, unambiguous alphabet so it is easy to read aloud and type.
    expect(code.userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(code.userCode).not.toMatch(VOWELS_AND_AMBIGUOUS);

    expect(store.grants.has(code.deviceCode)).toBe(true);
  });

  test("requestCode applies the default TTL and poll interval", async () => {
    const before = Math.floor(Date.now() / 1000);
    const store = fakeStore();
    const code = await new DeviceService(store).requestCode();

    expect(code.expiresInSeconds).toBe(15 * 60);
    expect(code.intervalSeconds).toBe(5);

    const stored = store.grants.get(code.deviceCode);
    expect(stored?.expiresAt).toBeGreaterThanOrEqual(before + 15 * 60);
  });

  test("successive default user codes differ (randomized)", async () => {
    const store = fakeStore();
    const service = new DeviceService(store);
    const a = await service.requestCode();
    const b = await service.requestCode();
    expect(a.deviceCode).not.toBe(b.deviceCode);
  });

  test("redeem with the default clock treats a future grant as still pending", async () => {
    const store = fakeStore();
    const service = new DeviceService(store);
    const issued = await service.requestCode();
    const result = await service.redeem(issued.deviceCode);
    expect(result).toEqual({ ok: false, error: "authorization_pending" });
  });
});
