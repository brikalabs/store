import { readTarGzEntries, tarballPath } from "@brika/registry-core";
import { contentTypeFor, REGISTRY_ORIGIN } from "@/lib/registry/registry-source";
import type { BlobStore } from "@/server/ports/blob-store";

/**
 * Serve a file bundled inside a registry tarball (icon, screenshots, readme,
 * localized `store.json`). The npm path gets these from jsDelivr; our registry
 * has no CDN, so the store extracts them from the tarball and caches the result
 * in its own R2 (`ASSETS`) keyed by `reg/<name>@<version>/<path>`. Versions are
 * immutable, so a cache hit is always valid and the tarball is fetched at most
 * once per asset.
 */

export interface ExtractedAsset {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/** One published file, npm-style: leading-slash path plus rich metadata. */
export interface PluginFileEntry {
  readonly path: string;
  readonly type: "File";
  readonly size: number;
  readonly contentType: string;
  readonly hex: string;
  readonly isBinary: boolean;
  readonly linesCount: number;
}

/**
 * The published tarball's file index, mirroring npm's
 * `/package/<name>/v/<version>/index`: a map keyed by leading-slash path plus
 * tarball-level aggregates.
 */
export interface PluginFileIndex {
  readonly files: Record<string, PluginFileEntry>;
  readonly totalSize: number;
  readonly fileCount: number;
  readonly shasum: string;
  readonly integrity: string;
}

function cacheKey(name: string, version: string, path: string): string {
  return `reg/${name}@${version}/${path}`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCodePoint(byte);
  return btoa(binary);
}

/** A file is binary if a NUL byte appears in its leading bytes (git's heuristic). */
function isBinaryContent(bytes: Uint8Array): boolean {
  return bytes.subarray(0, 8000).includes(0);
}

/** Newline-delimited line count; a final line without a trailing `\n` still counts. */
function countLines(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  let newlines = 0;
  for (const byte of bytes) if (byte === 0x0a) newlines += 1;
  return bytes.at(-1) === 0x0a ? newlines : newlines + 1;
}

/**
 * The file's content type: the precise type for the known asset/image kinds we
 * serve, otherwise derived from the bytes (text vs binary). Keeps the index
 * useful without a per-language MIME list to maintain.
 */
function fileContentType(path: string, isBinary: boolean): string {
  const known = contentTypeFor(path);
  if (known !== "application/octet-stream") return known;
  return isBinary ? "application/octet-stream" : "text/plain; charset=utf-8";
}

/** Describe one tarball entry the way npm's file index does. */
async function describeFile(path: string, bytes: Uint8Array): Promise<PluginFileEntry> {
  const binary = isBinaryContent(bytes);
  // Copy into a fresh ArrayBuffer-backed view so the digest input type is
  // concrete (the tar reader yields `Uint8Array<ArrayBufferLike>`).
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return {
    path: `/${path}`,
    type: "File",
    size: bytes.length,
    contentType: fileContentType(path, binary),
    hex: toHex(digest),
    isBinary: binary,
    linesCount: binary ? 0 : countLines(bytes),
  };
}

/** Fetch the tarball from the registry and pull a single file out of it. */
async function extractFromTarball(
  name: string,
  version: string,
  path: string,
): Promise<Uint8Array | null> {
  const res = await fetch(`${REGISTRY_ORIGIN}/${tarballPath(name, version)}`);
  if (!res.ok) return null;
  const entries = await readTarGzEntries(new Uint8Array(await res.arrayBuffer()));
  const entry = entries.find((candidate) => candidate.path === path);
  return entry?.data ?? null;
}

/**
 * The published tarball's file index, npm-style (a path-keyed map of rich file
 * metadata plus tarball-level aggregates). The file browser fetches this lazily,
 * only when the Supply chain tab opens, so the detail page never ships it. The
 * tarball is unpacked, hashed, and measured exactly once: the result is cached
 * in R2 as JSON (versions are immutable), so it is never recomputed per request.
 */
export async function getRegistryFileList(
  assets: BlobStore,
  name: string,
  version: string,
): Promise<PluginFileIndex | null> {
  const key = cacheKey(name, version, "__index.json");
  const cached = await assets.get(key);
  if (cached !== null) return JSON.parse(new TextDecoder().decode(cached)) as PluginFileIndex;

  const res = await fetch(`${REGISTRY_ORIGIN}/${tarballPath(name, version)}`);
  if (!res.ok) return null;
  const tarball = new Uint8Array(await res.arrayBuffer());
  const entries = await readTarGzEntries(tarball);

  const described = await Promise.all(entries.map((entry) => describeFile(entry.path, entry.data)));
  described.sort((a, b) => a.path.localeCompare(b.path));

  const files: Record<string, PluginFileEntry> = {};
  let totalSize = 0;
  for (const file of described) {
    files[file.path] = file;
    totalSize += file.size;
  }

  const [sha1, sha512] = await Promise.all([
    crypto.subtle.digest("SHA-1", tarball),
    crypto.subtle.digest("SHA-512", tarball),
  ]);
  const index: PluginFileIndex = {
    files,
    totalSize,
    fileCount: described.length,
    shasum: toHex(sha1),
    integrity: `sha512-${toBase64(sha512)}`,
  };
  await assets.put(key, JSON.stringify(index), "application/json");
  return index;
}

/**
 * Return a bundled asset, serving from R2 when cached and otherwise extracting
 * it from the tarball and caching it. Returns null when the asset is absent.
 */
export async function getRegistryAsset(
  assets: BlobStore,
  name: string,
  version: string,
  path: string,
): Promise<ExtractedAsset | null> {
  // Derive the content type from the bytes (same rule as the file index), so a
  // served file always agrees with its index entry and text files render inline
  // instead of downloading. Done on every path, ignoring any stale cached type.
  const key = cacheKey(name, version, path);
  const cached = await assets.get(key);
  if (cached !== null) {
    return { bytes: cached, contentType: fileContentType(path, isBinaryContent(cached)) };
  }

  const bytes = await extractFromTarball(name, version, path);
  if (bytes === null) return null;
  const contentType = fileContentType(path, isBinaryContent(bytes));
  await assets.put(key, bytes, contentType);
  return { bytes, contentType };
}

/** Read a bundled text file (readme, `store.json`) from the tarball, or null. */
export async function getRegistryAssetText(
  assets: BlobStore,
  name: string,
  version: string,
  path: string,
): Promise<string | null> {
  const asset = await getRegistryAsset(assets, name, version, path);
  return asset === null ? null : new TextDecoder().decode(asset.bytes);
}
