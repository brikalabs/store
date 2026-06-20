import { afterEach, describe, expect, test } from "bun:test";
import { authorizeUrl, exchangeCode, fetchUser } from "@/lib/auth/github";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Stub the next `fetch` with a fixed status + JSON body. */
function stubFetch(opts: { ok: boolean; json?: unknown }): void {
  globalThis.fetch = (async () =>
    new Response(opts.json === undefined ? null : JSON.stringify(opts.json), {
      status: opts.ok ? 200 : 500,
    })) as typeof fetch;
}

describe("authorizeUrl", () => {
  test("builds the GitHub consent URL with the read:user scope", () => {
    const url = new URL(authorizeUrl("client-1", "https://store.example/cb", "state-xyz"));
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe("https://store.example/cb");
    expect(url.searchParams.get("scope")).toBe("read:user");
    expect(url.searchParams.get("state")).toBe("state-xyz");
  });
});

describe("exchangeCode", () => {
  test("returns the access token from a successful exchange", async () => {
    stubFetch({ ok: true, json: { access_token: "gho_token" } });
    expect(await exchangeCode("code", "id", "secret")).toBe("gho_token");
  });

  test("returns null on a non-ok response", async () => {
    stubFetch({ ok: false });
    expect(await exchangeCode("code", "id", "secret")).toBeNull();
  });

  test("returns null when the body has no access_token (e.g. bad code)", async () => {
    stubFetch({ ok: true, json: { error: "bad_verification_code" } });
    expect(await exchangeCode("code", "id", "secret")).toBeNull();
  });
});

describe("fetchUser", () => {
  test("maps the GitHub user (snake_case avatar_url -> avatarUrl)", async () => {
    stubFetch({
      ok: true,
      json: { id: 42, login: "octocat", name: "The Octocat", avatar_url: "https://a/v.png" },
    });
    expect(await fetchUser("tok")).toEqual({
      id: 42,
      login: "octocat",
      name: "The Octocat",
      avatarUrl: "https://a/v.png",
    });
  });

  test("tolerates a null name and missing avatar", async () => {
    stubFetch({ ok: true, json: { id: 1, login: "x", name: null } });
    expect(await fetchUser("tok")).toEqual({
      id: 1,
      login: "x",
      name: undefined,
      avatarUrl: undefined,
    });
  });

  test("returns null on a non-ok response", async () => {
    stubFetch({ ok: false });
    expect(await fetchUser("tok")).toBeNull();
  });

  test("returns null on an unexpected body (missing id)", async () => {
    stubFetch({ ok: true, json: { login: "x" } });
    expect(await fetchUser("tok")).toBeNull();
  });
});
