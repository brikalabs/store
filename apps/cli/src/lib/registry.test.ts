import { describe, expect, test } from "bun:test";
import { CliError } from "@brika/cli-kit";
import { type DeviceCode, type FetchLike, RegistryClient } from "./registry";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// interval 0 keeps `waitForToken` polling fast in tests.
const device: DeviceCode = {
  device_code: "d",
  user_code: "U-1",
  verification_uri: "https://v.test",
  interval: 0,
  expires_in: 900,
};

const PUBLISH: Parameters<RegistryClient["publish"]>[1] = {
  name: "@s/p",
  version: "1.0.0",
  manifest: {},
  tarball: "",
};

describe("RegistryClient", () => {
  test("requestDeviceCode parses a valid response", async () => {
    const client = new RegistryClient("https://r.test", { fetch: async () => json(device) });
    expect((await client.requestDeviceCode()).user_code).toBe("U-1");
  });

  test("waitForToken returns the issued token once approved", async () => {
    const client = new RegistryClient("https://r.test", {
      fetch: async () => json({ access_token: "brika_x", github_login: "me" }),
    });
    expect(await client.waitForToken(device)).toEqual({ token: "brika_x", githubLogin: "me" });
  });

  test("waitForToken throws when the device flow is denied", async () => {
    const client = new RegistryClient("https://r.test", {
      fetch: async () => json({ error: "access_denied" }, 400),
    });
    await expect(client.waitForToken(device)).rejects.toBeInstanceOf(CliError);
  });

  test("waitForToken throws when the deadline passes", async () => {
    const client = new RegistryClient("https://r.test", {
      fetch: async () => json({ error: "authorization_pending" }, 400),
    });
    await expect(client.waitForToken({ ...device, expires_in: 0 })).rejects.toThrow(/timed out/);
  });

  test("publish returns the integrity on success", async () => {
    const client = new RegistryClient("https://r.test", {
      fetch: async () => json({ integrity: "sha512-x" }, 201),
    });
    expect(await client.publish("t", PUBLISH)).toEqual({ integrity: "sha512-x" });
  });

  test("publish throws on a rejection", async () => {
    const client = new RegistryClient("https://r.test", {
      fetch: async () => json({ error: "exists", code: "exists" }, 409),
    });
    await expect(client.publish("t", PUBLISH)).rejects.toBeInstanceOf(CliError);
  });

  test("times out", async () => {
    const hang: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "TimeoutError")),
        );
      });
    const client = new RegistryClient("https://r.test", { fetch: hang, timeoutMs: 10 });
    await expect(client.requestDeviceCode()).rejects.toBeInstanceOf(CliError);
  });

  test("wraps a network error in a CliError", async () => {
    const client = new RegistryClient("https://r.test", {
      fetch: async () => {
        throw new TypeError("ECONNREFUSED");
      },
    });
    await expect(client.requestDeviceCode()).rejects.toBeInstanceOf(CliError);
  });
});
