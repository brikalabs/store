import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { SchemaManifestValidator } from "./manifest-validator";

const validator = new SchemaManifestValidator();

const valid = {
  name: "@brika/plugin-x",
  version: "1.2.3",
  main: "./src/index.ts",
  engines: { brika: "^0.4.0" },
  icon: "./icon.svg",
  displayName: "Plugin X",
  description: "Does a thing",
};

const BLOCK = 512;
const ENCODER = new TextEncoder();

/** Build a USTAR header block for `package/<path>`. */
function header(path: string, size: number): Uint8Array {
  const block = new Uint8Array(BLOCK);
  block.set(ENCODER.encode(`package/${path}`), 0);
  block.set(ENCODER.encode(`${size.toString(8).padStart(11, "0")}\0`), 124);
  for (let i = 148; i < 156; i++) block[i] = 0x20;
  block[156] = 0x30;
  block.set(ENCODER.encode("ustar\0"), 257);
  block.set(ENCODER.encode("00"), 263);
  let checksum = 0;
  for (const byte of block) checksum += byte;
  block.set(ENCODER.encode(`${checksum.toString(8).padStart(6, "0")}\0 `), 148);
  return block;
}

/** Gzip a USTAR archive built from in-memory entries. */
function gzipTar(entries: ReadonlyArray<{ path: string; text: string }>): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    const data = ENCODER.encode(entry.text);
    blocks.push(header(entry.path, data.byteLength), data);
    const padding = (BLOCK - (data.byteLength % BLOCK)) % BLOCK;
    if (padding > 0) blocks.push(new Uint8Array(padding));
  }
  blocks.push(new Uint8Array(BLOCK * 2));
  const total = blocks.reduce((sum, b) => sum + b.byteLength, 0);
  const tar = new Uint8Array(total);
  let offset = 0;
  for (const b of blocks) {
    tar.set(b, offset);
    offset += b.byteLength;
  }
  return new Uint8Array(gzipSync(tar));
}

const EMPTY = gzipTar([]);

test("accepts a complete plugin manifest", async () => {
  expect(await validator.validate(valid, EMPTY)).toEqual({ ok: true });
});

test("requires an icon", async () => {
  const result = await validator.validate({ ...valid, icon: "" }, EMPTY);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("icon");
});

test("requires a title (displayName)", async () => {
  const { displayName, ...withoutTitle } = valid;
  void displayName;
  const result = await validator.validate(withoutTitle, EMPTY);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("displayName");
});

test("requires a description", async () => {
  const { description, ...withoutDescription } = valid;
  void description;
  expect((await validator.validate(withoutDescription, EMPTY)).ok).toBe(false);
});

test("requires the brika engine", async () => {
  const { engines, ...withoutEngine } = valid;
  void engines;
  expect((await validator.validate(withoutEngine, EMPTY)).ok).toBe(false);
});

test("requires a main entrypoint", async () => {
  const { main, ...withoutMain } = valid;
  void main;
  const result = await validator.validate(withoutMain, EMPTY);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("main");
});

test("rejects a non-semver version", async () => {
  const result = await validator.validate({ ...valid, version: "latest" }, EMPTY);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("version");
});

test("rejects an icon path that escapes the package root", async () => {
  const result = await validator.validate({ ...valid, icon: "../../etc/passwd" }, EMPTY);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("icon");
});

test("accepts a valid bundled locale file", async () => {
  const tarball = gzipTar([
    {
      path: "locales/fr/store.json",
      text: JSON.stringify({ title: "Plugin X", description: "Fait une chose" }),
    },
  ]);
  expect(await validator.validate(valid, tarball)).toEqual({ ok: true });
});

test("rejects an invalid bundled locale file, naming the path", async () => {
  const tarball = gzipTar([
    { path: "locales/fr/store.json", text: JSON.stringify({ description: "missing title" }) },
  ]);
  const result = await validator.validate(valid, tarball);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("locales/fr/store.json");
});

test("rejects a tarball that is not a readable gzip archive", async () => {
  const result = await validator.validate(valid, new TextEncoder().encode("not gzip"));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("readable gzip archive");
});

test("rejects a bundled file over the per-file size limit", async () => {
  const small = new SchemaManifestValidator({ maxFileBytes: 16 });
  const tarball = gzipTar([{ path: "big.txt", text: "x".repeat(64) }]);
  const result = await small.validate(valid, tarball);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("file limit");
});

test("rejects a package over the unpacked-size limit", async () => {
  const small = new SchemaManifestValidator({ maxFileBytes: 1024, maxUnpackedBytes: 32 });
  const tarball = gzipTar([
    { path: "a.txt", text: "x".repeat(20) },
    { path: "b.txt", text: "y".repeat(20) },
  ]);
  const result = await small.validate(valid, tarball);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toContain("unpacked size");
});
