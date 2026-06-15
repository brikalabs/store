import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { CliError } from "@brika/cli-kit";
import { sha1Hex, sha512Integrity } from "@brika/registry-core";

/**
 * Pack a package directory into an npm-compatible tarball entirely in-process:
 * no `npm` binary and no subprocess. We select the files (honoring the `files`
 * field, otherwise everything minus the usual junk), build a gzipped USTAR
 * archive under the conventional `package/` prefix, and compute the digests with
 * `@brika/registry-core` (the same code the registry verifies with). Because we
 * assemble the archive ourselves, the file list and unpacked size are exact.
 */

export interface PackedFile {
  readonly path: string;
  readonly size: number;
}

export interface Packed {
  readonly name: string;
  readonly version: string;
  readonly manifest: Record<string, unknown>;
  readonly tarball: Uint8Array;
  readonly filename: string;
  /** Subresource Integrity (`sha512-<base64>`); compared against the registry's. */
  readonly integrity: string;
  readonly shasum: string;
  /** Packed (gzipped) size in bytes. */
  readonly size: number;
  readonly unpackedSize: number;
  readonly files: readonly PackedFile[];
}

const BLOCK = 512;
// A fixed mtime makes the same inputs produce the same tarball + integrity.
const MTIME = 1_700_000_000;
const IGNORED_DIRS = new Set([".git", ".hg", ".svn", "CVS", "node_modules"]);
const ENCODER = new TextEncoder();

function byteLength(value: string): number {
  return ENCODER.encode(value).length;
}

function shouldIgnoreFile(name: string): boolean {
  return name === ".DS_Store" || name === ".npmrc" || name.endsWith(".tgz");
}

/** Recursively list files under `dir/rel`, skipping ignored directories/files. */
async function walk(dir: string, rel: string, out: string[]): Promise<void> {
  const entries = await readdir(join(dir, rel), { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel.length > 0 ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) await walk(dir, childRel, out);
    } else if (entry.isFile() && !shouldIgnoreFile(entry.name)) {
      out.push(childRel);
    }
  }
}

/** Files npm always ships, regardless of the `files` field. */
async function alwaysIncluded(dir: string): Promise<string[]> {
  const names = await readdir(dir);
  const extra = names.filter((name) => /^(readme|licen[sc]e|changelog|notice)(\.|$)/i.test(name));
  return ["package.json", ...extra];
}

/** Add a single `files` entry (a path or a directory tree) to the set. */
async function addFilesEntry(dir: string, raw: unknown, selected: Set<string>): Promise<void> {
  if (typeof raw !== "string") return;
  const entry = raw.replace(/^\.\//, "").replace(/\/$/, "");
  const info = await stat(join(dir, entry)).catch(() => null);
  if (info === null) return;
  if (info.isDirectory()) {
    const sub: string[] = [];
    await walk(dir, entry, sub);
    for (const file of sub) selected.add(file);
  } else if (info.isFile()) {
    selected.add(entry);
  }
}

async function selectFiles(dir: string, manifest: Record<string, unknown>): Promise<string[]> {
  const explicit = manifest.files;
  const selected = new Set<string>(await alwaysIncluded(dir));
  if (Array.isArray(explicit) && explicit.length > 0) {
    for (const raw of explicit) await addFilesEntry(dir, raw, selected);
  } else {
    const all: string[] = [];
    await walk(dir, "", all);
    for (const file of all) selected.add(file);
  }
  return [...selected].sort((a, b) => a.localeCompare(b));
}

function toOctal(value: number, width: number): string {
  // `width` includes the trailing NUL terminator.
  return `${value.toString(8).padStart(width - 1, "0")}\0`;
}

function writeAscii(block: Uint8Array, text: string, offset: number): void {
  block.set(ENCODER.encode(text), offset);
}

function splitName(path: string): { name: string; prefix: string } {
  if (byteLength(path) <= 100) return { name: path, prefix: "" };
  for (let i = path.lastIndexOf("/"); i > 0; i = path.lastIndexOf("/", i - 1)) {
    const prefix = path.slice(0, i);
    const rest = path.slice(i + 1);
    if (byteLength(rest) <= 100 && byteLength(prefix) <= 155) return { name: rest, prefix };
  }
  throw new CliError(`path too long to pack: ${path}`);
}

function tarHeader(path: string, size: number): Uint8Array {
  const block = new Uint8Array(BLOCK);
  const { name, prefix } = splitName(path);
  writeAscii(block, name, 0);
  writeAscii(block, toOctal(0o644, 8), 100); // mode
  writeAscii(block, toOctal(0, 8), 108); // uid
  writeAscii(block, toOctal(0, 8), 116); // gid
  writeAscii(block, toOctal(size, 12), 124); // size
  writeAscii(block, toOctal(MTIME, 12), 136); // mtime
  for (let i = 148; i < 156; i++) block[i] = 0x20; // checksum placeholder = spaces
  block[156] = 0x30; // typeflag '0' (regular file)
  writeAscii(block, "ustar\0", 257); // magic
  writeAscii(block, "00", 263); // version
  writeAscii(block, prefix, 345);

  let checksum = 0;
  for (const byte of block) checksum += byte;
  // 6 octal digits, then NUL and a space, per USTAR.
  writeAscii(block, `${checksum.toString(8).padStart(6, "0")}\0 `, 148);
  return block;
}

function buildTar(entries: readonly { path: string; data: Uint8Array }[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    blocks.push(tarHeader(`package/${entry.path}`, entry.data.byteLength), entry.data);
    const padding = (BLOCK - (entry.data.byteLength % BLOCK)) % BLOCK;
    if (padding > 0) blocks.push(new Uint8Array(padding));
  }
  blocks.push(new Uint8Array(BLOCK * 2)); // two zero blocks terminate the archive
  return new Uint8Array(Bun.concatArrayBuffers(blocks));
}

function tarballName(name: string, version: string): string {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

export async function packDirectory(dir: string): Promise<Packed> {
  const pkg = Bun.file(join(dir, "package.json"));
  if (!(await pkg.exists())) throw new CliError(`no package.json found in ${dir}`);
  let manifest: Record<string, unknown>;
  try {
    manifest = (await pkg.json()) as Record<string, unknown>;
  } catch {
    throw new CliError(`package.json in ${dir} is not valid JSON`);
  }
  const { name, version } = manifest;
  if (typeof name !== "string" || typeof version !== "string") {
    throw new CliError("package.json must have a string name and version");
  }

  const paths = await selectFiles(dir, manifest);
  const entries = await Promise.all(
    paths.map(async (path) => ({
      path,
      data: new Uint8Array(await readFile(join(dir, path))),
    })),
  );

  const tarball = new Uint8Array(gzipSync(buildTar(entries), { level: 9 }));
  const [integrity, shasum] = await Promise.all([sha512Integrity(tarball), sha1Hex(tarball)]);

  return {
    name,
    version,
    manifest,
    tarball,
    filename: tarballName(name, version),
    integrity,
    shasum,
    size: tarball.byteLength,
    unpackedSize: entries.reduce((sum, entry) => sum + entry.data.byteLength, 0),
    files: entries.map((entry) => ({ path: entry.path, size: entry.data.byteLength })),
  };
}
