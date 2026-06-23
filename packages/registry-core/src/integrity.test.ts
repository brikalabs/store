import { expect, test } from "bun:test";
import { sha1Hex, sha512Integrity } from "./integrity";

const abc = new TextEncoder().encode("abc");

test("sha1Hex matches the known vector for 'abc'", async () => {
  expect(await sha1Hex(abc)).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
});

test("sha512Integrity is an SRI string over a 64-byte digest", async () => {
  const sri = await sha512Integrity(abc);
  expect(sri.startsWith("sha512-")).toBe(true);
  expect(atob(sri.slice("sha512-".length))).toHaveLength(64);
});

test("digests are stable for the same input", async () => {
  expect(await sha512Integrity(abc)).toBe(await sha512Integrity(abc));
});
