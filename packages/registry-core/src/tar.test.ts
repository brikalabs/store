import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { readTarGzEntries } from "./tar";

const BLOCK = 512;
const ENCODER = new TextEncoder();

/** Build a single USTAR header block for `package/<path>`. Mirrors the CLI packer. */
function header(path: string, size: number): Uint8Array {
  const block = new Uint8Array(BLOCK);
  block.set(ENCODER.encode(`package/${path}`), 0);
  block.set(ENCODER.encode(`${(0o644).toString(8).padStart(7, "0")}\0`), 100); // mode
  block.set(ENCODER.encode(`${size.toString(8).padStart(11, "0")}\0`), 124); // size
  block.set(ENCODER.encode(`${(0).toString(8).padStart(11, "0")}\0`), 136); // mtime
  for (let i = 148; i < 156; i++) block[i] = 0x20; // checksum placeholder
  block[156] = 0x30; // typeflag '0' (regular file)
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
  blocks.push(new Uint8Array(BLOCK * 2)); // two zero blocks terminate the archive
  const total = blocks.reduce((sum, b) => sum + b.byteLength, 0);
  const tar = new Uint8Array(total);
  let offset = 0;
  for (const b of blocks) {
    tar.set(b, offset);
    offset += b.byteLength;
  }
  return new Uint8Array(gzipSync(tar));
}

test("reads entries and strips the package/ prefix", async () => {
  const entries = await readTarGzEntries(
    gzipTar([
      { path: "package.json", text: '{"name":"x"}' },
      { path: "locales/en/store.json", text: '{"title":"X"}' },
    ]),
  );
  const decoder = new TextDecoder();
  expect(entries.map((e) => e.path)).toEqual(["package.json", "locales/en/store.json"]);
  expect(decoder.decode(entries[1]?.data)).toBe('{"title":"X"}');
});

test("returns no entries for an empty archive", async () => {
  expect(await readTarGzEntries(gzipTar([]))).toEqual([]);
});

test("throws on bytes that are not a gzip stream", async () => {
  await expect(readTarGzEntries(new TextEncoder().encode("not gzip"))).rejects.toThrow();
});
