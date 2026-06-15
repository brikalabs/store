import { describe, expect, test } from "bun:test";
import { CliError } from "@brika/cli-kit";
import { type FetchLike, RegistryClient } from "./registry";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("RegistryClient", () => {
  test("requestDeviceCode parses a valid response", async () => {
    const client = new RegistryClient("https://r.test", {
      fetch: async () =>
        json({
          device_code: "d",
          user_code: "U-1",
          verification_uri: "https://v.test",
          interval: 5,
          expires_in: 900,
        }),
    });
    expect((await client.requestDeviceCode()).user_code).toBe("U-1");
  });

  test("pollDeviceToken maps pending and ok states", async () => {
    const pending = new RegistryClient("https://r.test", {
      fetch: async () => json({ error: "authorization_pending" }, 400),
    });
    expect((await pending.pollDeviceToken("d")).status).toBe("pending");

    const ok = new RegistryClient("https://r.test", {
      fetch: async () => json({ access_token: "brika_x", github_login: "me" }),
    });
    expect(await ok.pollDeviceToken("d")).toEqual({
      status: "ok",
      token: "brika_x",
      githubLogin: "me",
    });
  });

  test("publish reports success and rejection", async () => {
    const ok = new RegistryClient("https://r.test", {
      fetch: async () => json({ integrity: "sha512-x" }, 201),
    });
    expect(
      await ok.publish("t", { name: "@s/p", version: "1.0.0", manifest: {}, tarballBase64: "" }),
    ).toEqual({ ok: true, integrity: "sha512-x" });

    const conflict = new RegistryClient("https://r.test", {
      fetch: async () => json({ error: "exists", code: "exists" }, 409),
    });
    expect(
      await conflict.publish("t", {
        name: "@s/p",
        version: "1.0.0",
        manifest: {},
        tarballBase64: "",
      }),
    ).toMatchObject({ ok: false, status: 409, code: "exists" });
  });

  test("times out", async () => {
    const hang: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
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
