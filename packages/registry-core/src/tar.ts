/**
 * Minimal gzip + USTAR tar reader, so the publish gate can look inside an uploaded tarball without a
 * tar dependency. The read counterpart to the CLI's packer (same `package/` prefix, 512-byte USTAR
 * blocks). Pure bytes (Streams, no Node imports) so it stays in the runtime-agnostic core.
 */

const BLOCK = 512;
const PACKAGE_PREFIX = "package/";
// USTAR header field offsets and lengths within a 512-byte block.
const NAME_OFFSET = 0;
const NAME_LEN = 100;
const SIZE_OFFSET = 124;
const SIZE_LEN = 12;
const TYPEFLAG_OFFSET = 156;
const PREFIX_OFFSET = 345;
const PREFIX_LEN = 155;
// Typeflags that denote a regular file: '0' (0x30) and the legacy NUL.
const TYPE_FILE = 0x30;
const TYPE_FILE_LEGACY = 0;

export interface TarEntry {
  /** Path inside the archive, with the conventional `package/` prefix stripped. */
  readonly path: string;
  readonly data: Uint8Array;
}

async function gunzip(gzipped: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer-backed view so the Blob/Streams signatures are
  // satisfied regardless of the caller's buffer type (mirrors `integrity.ts`).
  const view = new Uint8Array(gzipped.byteLength);
  view.set(gzipped);
  const stream = new Blob([view]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read a NUL-terminated ASCII field from a header block. */
function readField(block: Uint8Array, start: number, length: number, decoder: TextDecoder): string {
  const slice = block.subarray(start, start + length);
  const end = slice.indexOf(0);
  return decoder.decode(end === -1 ? slice : slice.subarray(0, end));
}

interface TarHeader {
  readonly typeflag: number | undefined;
  readonly fullName: string;
  readonly size: number;
}

// Returns null for a zero/terminator block or an unreadable size field, which both end the archive.
// The size field is octal.
function parseHeader(block: Uint8Array, decoder: TextDecoder): TarHeader | null {
  const name = readField(block, NAME_OFFSET, NAME_LEN, decoder);
  if (name === "") return null; // a zero block terminates the archive
  const sizeField = readField(block, SIZE_OFFSET, SIZE_LEN, decoder).trim();
  const size = sizeField === "" ? 0 : Number.parseInt(sizeField, 8);
  if (!Number.isFinite(size) || size < 0) return null;
  const prefix = readField(block, PREFIX_OFFSET, PREFIX_LEN, decoder);
  return {
    typeflag: block[TYPEFLAG_OFFSET],
    fullName: prefix === "" ? name : `${prefix}/${name}`,
    size,
  };
}

/** Strip the conventional `package/` prefix npm adds to every archived path. */
function stripPackagePrefix(fullName: string): string {
  return fullName.startsWith(PACKAGE_PREFIX) ? fullName.slice(PACKAGE_PREFIX.length) : fullName;
}

/**
 * Decompress a gzipped tarball and return its regular-file entries. Throws if the bytes are not a
 * readable gzip stream; non-file entries (directories, symlinks) are skipped.
 */
export async function readTarGzEntries(gzipped: Uint8Array): Promise<TarEntry[]> {
  const tar = await gunzip(gzipped);
  const decoder = new TextDecoder();
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + BLOCK <= tar.byteLength) {
    const header = parseHeader(tar.subarray(offset, offset + BLOCK), decoder);
    if (header === null) break;
    offset += BLOCK;
    if (header.typeflag === TYPE_FILE || header.typeflag === TYPE_FILE_LEGACY) {
      const path = stripPackagePrefix(header.fullName);
      entries.push({ path, data: new Uint8Array(tar.subarray(offset, offset + header.size)) });
    }
    offset += Math.ceil(header.size / BLOCK) * BLOCK;
  }
  return entries;
}
