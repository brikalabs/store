import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { packDirectory } from "./tarball";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "brika-pack-test-"));
  await writeFile(
    join(dir, "package.json"),
    `${JSON.stringify({ name: "@test/p", version: "1.0.0", main: "./index.js" })}\n`,
  );
  await writeFile(join(dir, "index.js"), "export default 1;\n");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("packs in-process and reports digests + file list", async () => {
  const packed = await packDirectory(dir);
  expect(packed.name).toBe("@test/p");
  expect(packed.version).toBe("1.0.0");
  expect(packed.filename).toBe("test-p-1.0.0.tgz");
  expect(packed.integrity).toMatch(/^sha512-/);
  expect(packed.shasum).toMatch(/^[0-9a-f]{40}$/);
  expect(packed.size).toBeGreaterThan(0);
  expect(packed.unpackedSize).toBeGreaterThan(0);
  const paths = packed.files.map((file) => file.path);
  expect(paths).toContain("package.json");
  expect(paths).toContain("index.js");
});

test("produces a valid ustar archive under the package/ prefix", async () => {
  const packed = await packDirectory(dir);
  const tar = gunzipSync(packed.tarball);
  // USTAR magic lives at offset 257 of the first header block.
  expect(new TextDecoder().decode(tar.subarray(257, 262))).toBe("ustar");
  const firstName = new TextDecoder().decode(tar.subarray(0, 100)).replace(/\0+$/, "");
  expect(firstName.startsWith("package/")).toBe(true);
});
