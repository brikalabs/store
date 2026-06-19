import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HttpError } from "@brika/router";
import type { Db } from "@brika/store-db";
import { D1TokenStore, issueToken } from "./adapters/token";
import { AUDIENCE, authenticateWrite, requireAdmin, requireWrite } from "./auth";
import { makeDb } from "./test-harness";

/**
 * Tests for the shared write-authentication. The registry-token branch runs
 * fully offline; the GitHub OIDC branch is exercised by signing a token with a
 * locally generated RSA key and stubbing `fetch` to serve the matching JWKS,
 * so no real network call is made.
 */

const KID = "test-key-1";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function encodePart(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** Build a signed RS256 OIDC token plus the public JWK that verifies it. */
async function signedOidc(
  claims: Record<string, unknown>,
): Promise<{ token: string; jwk: object }> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as {
    kty: string;
    n: string;
    e: string;
  };
  const header = encodePart({ alg: "RS256", kid: KID });
  const payload = encodePart(claims);
  const signingInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, signingInput),
  );
  return {
    token: `${header}.${payload}.${base64Url(signature)}`,
    jwk: { kid: KID, kty: publicJwk.kty, n: publicJwk.n, e: publicJwk.e },
  };
}

function bearer(token: string): Request {
  return new Request("http://localhost/", { headers: { authorization: `Bearer ${token}` } });
}

let db: Db;
let tokens: D1TokenStore;
beforeEach(() => {
  db = makeDb();
  tokens = new D1TokenStore(db);
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("authenticateWrite (no credential)", () => {
  test("returns null when there is no authorization header", async () => {
    expect(await authenticateWrite(new Request("http://localhost/"), tokens)).toBeNull();
  });

  test("returns null for a non-Bearer authorization scheme", async () => {
    const req = new Request("http://localhost/", { headers: { authorization: "Basic abc" } });
    expect(await authenticateWrite(req, tokens)).toBeNull();
  });

  test("returns null for an opaque (non-JWT) token that is not a registry token", async () => {
    // No dots => OIDC verify short-circuits to null with no network call.
    expect(await authenticateWrite(bearer("not-a-jwt"), tokens)).toBeNull();
  });
});

describe("authenticateWrite (registry publish token)", () => {
  test("resolves a registry token to its owner identity (no repository)", async () => {
    const token = await issueToken(db, "octocat");
    const identity = await authenticateWrite(bearer(token), tokens);
    expect(identity).toEqual({ provider: "github", owner: "octocat", repository: null });
  });

  test("returns null for a brika_-prefixed token that does not exist", async () => {
    expect(await authenticateWrite(bearer("brika_unknown"), tokens)).toBeNull();
  });
});

describe("authenticateWrite (GitHub OIDC)", () => {
  test("resolves a valid OIDC token to a CI identity with provenance", async () => {
    const { token, jwk } = await signedOidc({
      iss: "https://token.actions.githubusercontent.com",
      aud: AUDIENCE,
      sub: "repo:brika/store:ref:refs/heads/main",
      repository: "brika/store",
      repository_owner: "brika",
      ref: "refs/heads/main",
      sha: "cafef00d",
      workflow_ref: "brika/store/.github/workflows/publish.yml@refs/heads/main",
      run_id: "42",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const identity = await authenticateWrite(bearer(token), tokens);
    expect(identity).toEqual({
      provider: "github",
      owner: "brika",
      repository: "brika/store",
      provenance: {
        repository: "brika/store",
        sha: "cafef00d",
        ref: "refs/heads/main",
        workflowRef: "brika/store/.github/workflows/publish.yml@refs/heads/main",
        runId: "42",
      },
    });
  });
});

describe("requireWrite", () => {
  test("returns the identity when a credential validates", async () => {
    const token = await issueToken(db, "octocat");
    expect(await requireWrite(bearer(token), tokens)).toEqual({
      provider: "github",
      owner: "octocat",
      repository: null,
    });
  });

  test("throws 401 Unauthorized when no credential validates", async () => {
    try {
      await requireWrite(new Request("http://localhost/"), tokens);
      throw new Error("expected requireWrite to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(401);
    }
  });
});

describe("requireAdmin", () => {
  const status = async (run: Promise<unknown>): Promise<number> => {
    try {
      await run;
      return 200;
    } catch (error) {
      if (error instanceof HttpError) return error.status;
      throw error;
    }
  };

  test("401 when no credential is presented", async () => {
    expect(
      await status(
        requireAdmin(new Request("http://localhost/"), tokens, new Set(["github:octocat"])),
      ),
    ).toBe(401);
  });

  test("403 when the credential is valid but the owner is not an admin", async () => {
    const token = await issueToken(db, "stranger");
    expect(await status(requireAdmin(bearer(token), tokens, new Set(["github:octocat"])))).toBe(
      403,
    );
  });

  test("returns the identity when the owner is in the admin allowlist", async () => {
    const token = await issueToken(db, "octocat");
    expect(await requireAdmin(bearer(token), tokens, new Set(["github:octocat"]))).toEqual({
      provider: "github",
      owner: "octocat",
      repository: null,
    });
  });
});
