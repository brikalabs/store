import { afterEach, describe, expect, test } from "bun:test";
import {
  type AttestationProvider,
  attestationProviderIds,
  clearAttestationProviders,
  getAttestationProvider,
  nullAttestationProvider,
  registerAttestationProvider,
  TransparencyEntry,
} from "./attestation";

afterEach(() => clearAttestationProviders());

const fakeEntry: TransparencyEntry = {
  provider: "fake",
  logUrl: "https://search.example.dev/?logIndex=42",
  logIndex: "42",
  integrity: "sha512-abc",
};

function fakeProvider(id = "fake"): AttestationProvider {
  return {
    id,
    attest: (input) => Promise.resolve({ ...fakeEntry, provider: id, integrity: input.integrity }),
    verify: (entry) => Promise.resolve(entry.integrity === "sha512-abc"),
  };
}

describe("TransparencyEntry schema", () => {
  test("accepts a well-formed entry and rejects a bad URL", () => {
    expect(TransparencyEntry.safeParse(fakeEntry).success).toBe(true);
    expect(TransparencyEntry.safeParse({ ...fakeEntry, logUrl: "not-a-url" }).success).toBe(false);
  });
});

describe("provider registry", () => {
  test("register / get / list / clear", () => {
    expect(getAttestationProvider("fake")).toBeNull();
    registerAttestationProvider(fakeProvider());
    expect(getAttestationProvider("fake")?.id).toBe("fake");
    expect(attestationProviderIds()).toEqual(["fake"]);
    clearAttestationProviders();
    expect(getAttestationProvider("fake")).toBeNull();
  });

  test("last registration under an id wins (swap the provider)", () => {
    registerAttestationProvider(fakeProvider("sigstore"));
    const replacement: AttestationProvider = {
      ...fakeProvider("sigstore"),
      attest: () => Promise.resolve(null),
    };
    registerAttestationProvider(replacement);
    expect(attestationProviderIds()).toEqual(["sigstore"]);
  });
});

describe("provider behaviour", () => {
  test("a provider attests and verifies its own entry", async () => {
    const provider = fakeProvider();
    const entry = await provider.attest({ integrity: "sha512-abc", subject: "@brika/x@1.0.0" });
    expect(entry?.provider).toBe("fake");
    expect(entry?.integrity).toBe("sha512-abc");
    expect(await provider.verify(entry as TransparencyEntry)).toBe(true);
    expect(await provider.verify({ ...fakeEntry, integrity: "sha512-other" })).toBe(false);
  });

  test("nullAttestationProvider never attests or verifies", async () => {
    expect(await nullAttestationProvider.attest({ integrity: "x", subject: "y" })).toBeNull();
    expect(await nullAttestationProvider.verify(fakeEntry)).toBe(false);
  });
});
