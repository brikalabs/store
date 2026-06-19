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

  test("deprecate posts to the encoded management endpoint with the message", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const client = new RegistryClient("https://r.test", {
      fetch: async (input, init) => {
        calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        return json({ ok: true });
      },
    });
    await client.deprecate("t", "@brika/plugin-x", "1.2.3", "old");
    // The name is encoded as a single npm-style segment (`@scope%2Fpkg`); the
    // registry's `:name` token resolves it back to `@brika/plugin-x`.
    expect(calls[0]?.url).toBe("https://r.test/-/package/@brika%2Fplugin-x/1.2.3/deprecate");
    expect(calls[0]?.body).toEqual({ message: "old" });
  });

  test("deprecate --undo sends a null message", async () => {
    let sent: unknown;
    const client = new RegistryClient("https://r.test", {
      fetch: async (_input, init) => {
        sent = JSON.parse(String(init?.body));
        return json({ ok: true });
      },
    });
    await client.deprecate("t", "@brika/plugin-x", "1.2.3", null);
    expect(sent).toEqual({ message: null });
  });

  test("yank posts the boolean and throws a CliError on rejection", async () => {
    let sent: unknown;
    const ok = new RegistryClient("https://r.test", {
      fetch: async (_input, init) => {
        sent = JSON.parse(String(init?.body));
        return json({ ok: true });
      },
    });
    await ok.yank("t", "@brika/plugin-x", "1.2.3", true);
    expect(sent).toEqual({ yanked: true });

    const denied = new RegistryClient("https://r.test", {
      fetch: async () =>
        json({ error: "scope @brika is owned by someone", code: "forbidden" }, 403),
    });
    await expect(denied.yank("t", "@brika/plugin-x", "1.2.3", true)).rejects.toBeInstanceOf(
      CliError,
    );
  });

  test("createScope PUTs to the encoded scope endpoint and reports created", async () => {
    const calls: { url: string; method?: string }[] = [];
    const client = new RegistryClient("https://r.test", {
      fetch: async (input, init) => {
        calls.push({ url: String(input), method: init?.method });
        return json({ ok: true, scope: "@brika", created: true });
      },
    });
    const claim = await client.createScope("t", "@brika");
    expect(claim).toEqual({ scope: "@brika", created: true });
    expect(calls[0]?.url).toBe("https://r.test/-/scope/%40brika");
    expect(calls[0]?.method).toBe("PUT");
  });

  test("createScope throws a CliError when the scope is owned by someone else", async () => {
    const denied = new RegistryClient("https://r.test", {
      fetch: async () => json({ error: "scope @brika is owned by alice", code: "conflict" }, 409),
    });
    await expect(denied.createScope("t", "@brika")).rejects.toBeInstanceOf(CliError);
  });

  test("listScopeMembers GETs the members endpoint and returns the roster", async () => {
    const calls: { url: string; method?: string }[] = [];
    const client = new RegistryClient("https://r.test", {
      fetch: async (input, init) => {
        calls.push({ url: String(input), method: init?.method });
        return json({ ok: true, members: [{ provider: "github", id: "alice", role: "admin" }] });
      },
    });
    const members = await client.listScopeMembers("t", "@brika");
    expect(members).toEqual([{ provider: "github", id: "alice", role: "admin" }]);
    expect(calls[0]?.url).toBe("https://r.test/-/scope/%40brika/members");
    expect(calls[0]?.method).toBe("GET");
  });

  test("setScopeMember PUTs the role to the encoded member path", async () => {
    let sent: unknown;
    const calls: { url: string; method?: string }[] = [];
    const client = new RegistryClient("https://r.test", {
      fetch: async (input, init) => {
        calls.push({ url: String(input), method: init?.method });
        sent = JSON.parse(String(init?.body));
        return json({ ok: true });
      },
    });
    await client.setScopeMember("t", "@brika", { provider: "github", id: "alice" }, "admin");
    expect(calls[0]?.url).toBe("https://r.test/-/scope/%40brika/member/github/alice");
    expect(calls[0]?.method).toBe("PUT");
    expect(sent).toEqual({ role: "admin" });
  });

  test("removeScopeMember DELETEs and surfaces the last-admin conflict as a CliError", async () => {
    const calls: { url: string; method?: string }[] = [];
    const ok = new RegistryClient("https://r.test", {
      fetch: async (input, init) => {
        calls.push({ url: String(input), method: init?.method });
        return json({ ok: true });
      },
    });
    await ok.removeScopeMember("t", "@brika", { provider: "github", id: "alice" });
    expect(calls[0]?.method).toBe("DELETE");

    const denied = new RegistryClient("https://r.test", {
      fetch: async () => json({ error: "must keep at least one admin", code: "conflict" }, 409),
    });
    await expect(
      denied.removeScopeMember("t", "@brika", { provider: "github", id: "alice" }),
    ).rejects.toBeInstanceOf(CliError);
  });
});
