import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { requestGithubOidcToken } from "./oidc";

const URL_VAR = "ACTIONS_ID_TOKEN_REQUEST_URL";
const TOKEN_VAR = "ACTIONS_ID_TOKEN_REQUEST_TOKEN";

describe("requestGithubOidcToken", () => {
  const original = { url: process.env[URL_VAR], token: process.env[TOKEN_VAR] };
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    delete process.env[URL_VAR];
    delete process.env[TOKEN_VAR];
  });
  afterEach(() => {
    if (original.url === undefined) delete process.env[URL_VAR];
    else process.env[URL_VAR] = original.url;
    if (original.token === undefined) delete process.env[TOKEN_VAR];
    else process.env[TOKEN_VAR] = original.token;
    globalThis.fetch = originalFetch;
  });

  test("returns null when not running in GitHub Actions (no env)", async () => {
    expect(await requestGithubOidcToken("brika-registry")).toBeNull();
  });

  test("requests the token with the audience and returns its value", async () => {
    process.env[URL_VAR] = "https://token.example/req?api-version=2.0";
    process.env[TOKEN_VAR] = "req-token";
    let calledUrl = "";
    let auth = "";
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
      calledUrl = String(input);
      auth = String((init?.headers as Record<string, string>)?.authorization ?? "");
      return new Response(JSON.stringify({ value: "the.jwt.token" }), { status: 200 });
    }) as typeof fetch;

    expect(await requestGithubOidcToken("brika-registry")).toBe("the.jwt.token");
    expect(calledUrl).toContain("audience=brika-registry");
    expect(auth).toBe("Bearer req-token");
  });

  test("returns null on a non-ok response", async () => {
    process.env[URL_VAR] = "https://token.example/req";
    process.env[TOKEN_VAR] = "req-token";
    globalThis.fetch = (async () =>
      new Response("nope", { status: 500 })) as unknown as typeof fetch;
    expect(await requestGithubOidcToken("brika-registry")).toBeNull();
  });
});
