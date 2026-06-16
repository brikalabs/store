import { expect, test } from "bun:test";
import type { Packed } from "../lib/tarball";
import { formatBytes, printSummary } from "./summary";

test("formatBytes scales units", () => {
  expect(formatBytes(0)).toBe("0 B");
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(1024)).toBe("1.0 KiB");
  expect(formatBytes(1536)).toBe("1.5 KiB");
  expect(formatBytes(1024 * 1024)).toBe("1.0 MiB");
});

test("printSummary renders the note box without throwing", () => {
  const packed = {
    name: "@brika/plugin-x",
    version: "1.0.0",
    manifest: {},
    tarball: new Uint8Array(),
    filename: "plugin-x-1.0.0.tgz",
    integrity: "sha512-abc",
    shasum: "deadbeef",
    size: 2048,
    unpackedSize: 4096,
    files: [
      { path: "package.json", size: 200 },
      { path: "src/index.ts", size: 1800 },
    ],
    localeFiles: [],
  } satisfies Packed;
  // Smoke test: printSummary writes a clack note to stdout; assert it runs clean.
  expect(() => printSummary(packed)).not.toThrow();
});
