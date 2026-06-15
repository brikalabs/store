import { expect, test } from "bun:test";
import { decodeSegment, parseTarballVersion } from "./npm-url";

test("decodeSegment normalizes %2f-encoded scoped names", () => {
  expect(decodeSegment("@brika%2fplugin-x")).toBe("@brika/plugin-x");
  expect(decodeSegment("@brika%2Fplugin-x")).toBe("@brika/plugin-x");
  expect(decodeSegment("plugin-x")).toBe("plugin-x");
});

test("decodeSegment leaves malformed input unchanged", () => {
  expect(decodeSegment("%ZZ")).toBe("%ZZ");
});

test("parseTarballVersion extracts the version, including prereleases", () => {
  expect(parseTarballVersion("@brika/plugin-x", "plugin-x-1.2.3.tgz")).toBe("1.2.3");
  expect(parseTarballVersion("plugin-x", "plugin-x-0.1.0-beta.1.tgz")).toBe("0.1.0-beta.1");
});

test("parseTarballVersion rejects a mismatched name or extension", () => {
  expect(parseTarballVersion("@brika/plugin-x", "other-1.0.0.tgz")).toBeNull();
  expect(parseTarballVersion("@brika/plugin-x", "plugin-x-1.0.0.txt")).toBeNull();
});
