import { afterEach, describe, expect, test } from "bun:test";
import { canAttestInCi, entryFromBundle, rekorSearchUrl, sigstoreProvider } from "./sigstore";

const realFetch = globalThis.fetch;
const ciEnv = { ACTIONS_ID_TOKEN_REQUEST_URL: "https://x", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "t" };
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const key of Object.keys(ciEnv)) delete process.env[key];
});

describe("canAttestInCi", () => {
  test("true only when both GitHub OIDC env vars are present", () => {
    expect(canAttestInCi({})).toBe(false);
    expect(canAttestInCi({ ACTIONS_ID_TOKEN_REQUEST_URL: "https://x" })).toBe(false);
    expect(
      canAttestInCi({
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://x",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "tok",
      }),
    ).toBe(true);
  });
});

describe("rekorSearchUrl", () => {
  test("links a log index, falling back to the search home", () => {
    expect(rekorSearchUrl("12345")).toBe("https://search.sigstore.dev/?logIndex=12345");
    expect(rekorSearchUrl()).toBe("https://search.sigstore.dev/");
  });
});

describe("entryFromBundle", () => {
  test("extracts the first tlog entry's index into a provider-agnostic entry", () => {
    const bundle = { verificationMaterial: { tlogEntries: [{ logIndex: "99" }] } };
    expect(entryFromBundle(bundle, "sha512-abc")).toEqual({
      provider: "sigstore",
      logUrl: "https://search.sigstore.dev/?logIndex=99",
      logIndex: "99",
      integrity: "sha512-abc",
    });
  });

  test("handles a bundle with no tlog entries (no index)", () => {
    const entry = entryFromBundle({ verificationMaterial: { tlogEntries: [] } }, "sha512-abc");
    expect(entry.logIndex).toBeUndefined();
    expect(entry.logUrl).toBe("https://search.sigstore.dev/");
  });
});

describe("sigstoreProvider", () => {
  test("does not attest outside CI (no OIDC env)", async () => {
    // The test runner is not GitHub Actions, so attest degrades to null.
    expect(
      await sigstoreProvider.attest({ integrity: "sha512-abc", subject: "@brika/x@1" }),
    ).toBeNull();
  });

  test("verify is false for a non-sigstore or index-less entry", async () => {
    expect(
      await sigstoreProvider.verify({ provider: "other", logUrl: "https://x", integrity: "y" }),
    ).toBe(false);
    expect(
      await sigstoreProvider.verify({ provider: "sigstore", logUrl: "https://x", integrity: "y" }),
    ).toBe(false);
  });

  test("verify checks the public Rekor log when an index is present", async () => {
    const entry = { provider: "sigstore", logUrl: "https://x", logIndex: "42", integrity: "y" };

    globalThis.fetch = (() =>
      Promise.resolve(new Response("{}", { status: 200 }))) as unknown as typeof fetch;
    expect(await sigstoreProvider.verify(entry)).toBe(true);

    globalThis.fetch = (() =>
      Promise.resolve(new Response("", { status: 404 }))) as unknown as typeof fetch;
    expect(await sigstoreProvider.verify(entry)).toBe(false);

    globalThis.fetch = (() => Promise.reject(new Error("network"))) as unknown as typeof fetch;
    expect(await sigstoreProvider.verify(entry)).toBe(false);
  });

  test("in CI without the sigstore package, attest degrades to null", async () => {
    Object.assign(process.env, ciEnv);
    expect(canAttestInCi()).toBe(true);
    // `sigstore` is not installed in this workspace, so the dynamic load returns
    // null and attestation is skipped rather than throwing.
    expect(
      await sigstoreProvider.attest({ integrity: "sha512-abc", subject: "@brika/x@1" }),
    ).toBeNull();
  });
});
