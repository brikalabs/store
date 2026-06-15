import { expect, test } from "bun:test";
import { type Jwk, type JwksProvider, verifyGithubOidc } from "./oidc";

const AUD = "brika-registry";
const NOW = 1_900_000_000;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

const keyPair = await crypto.subtle.generateKey(
  {
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["sign", "verify"],
);
const exported = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
const jwk: Jwk = {
  kid: "k1",
  kty: exported.kty ?? "RSA",
  n: exported.n ?? "",
  e: exported.e ?? "",
};
const jwks: JwksProvider = { keys: () => Promise.resolve([jwk]) };

function baseClaims(): Record<string, unknown> {
  return {
    iss: "https://token.actions.githubusercontent.com",
    aud: AUD,
    sub: "repo:acme/plugin-x:ref:refs/heads/main",
    repository: "acme/plugin-x",
    repository_owner: "acme",
    exp: NOW + 600,
    nbf: NOW - 10,
    iat: NOW,
  };
}

async function sign(claims: Record<string, unknown>): Promise<string> {
  const enc = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
  const data = `${enc({ alg: "RS256", kid: "k1", typ: "JWT" })}.${enc(claims)}`;
  const bytes = new TextEncoder().encode(data);
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keyPair.privateKey, view);
  return `${data}.${base64UrlEncode(new Uint8Array(signature))}`;
}

test("verifies a valid token and returns the repository claims", async () => {
  const claims = await verifyGithubOidc(await sign(baseClaims()), jwks, {
    audience: AUD,
    now: NOW,
  });
  expect(claims?.repository).toBe("acme/plugin-x");
  expect(claims?.repository_owner).toBe("acme");
});

test("rejects a wrong audience", async () => {
  const token = await sign({ ...baseClaims(), aud: "someone-else" });
  expect(await verifyGithubOidc(token, jwks, { audience: AUD, now: NOW })).toBeNull();
});

test("rejects an expired token", async () => {
  const token = await sign({ ...baseClaims(), exp: NOW - 1 });
  expect(await verifyGithubOidc(token, jwks, { audience: AUD, now: NOW })).toBeNull();
});

test("rejects a tampered signature", async () => {
  const token = await sign(baseClaims());
  const tampered = `${token.slice(0, -6)}AAAAAA`;
  expect(await verifyGithubOidc(tampered, jwks, { audience: AUD, now: NOW })).toBeNull();
});

test("rejects an unknown signing key", async () => {
  const token = await sign(baseClaims());
  const empty: JwksProvider = { keys: () => Promise.resolve([]) };
  expect(await verifyGithubOidc(token, empty, { audience: AUD, now: NOW })).toBeNull();
});
