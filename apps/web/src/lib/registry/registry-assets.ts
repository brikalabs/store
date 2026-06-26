import { readTarGzEntries, tarballPath } from "@brika/registry-core";
import { cacheJson } from "@/lib/blob-cache";
import { REGISTRY_ORIGIN, registryFetch } from "@/lib/registry/registry-http";
import { contentTypeFor } from "@/lib/registry/registry-paths";
import type { BlobStore } from "@/server/ports/blob-store";

/**
 * Serve a file bundled inside a registry tarball (icon, screenshots, readme, `store.json`). Our
 * registry has no CDN, so the store extracts files from the tarball and caches them in R2 keyed by
 * `reg/<name>@<version>/<path>`. Versions are immutable, so a cache hit is always valid.
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

/** The published tarball's file index (npm-style): a path-keyed map plus tarball-level aggregates. */
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

// Precise type for known asset/image kinds, else derived from the bytes (text vs binary).
function fileContentType(path: string, isBinary: boolean): string {
  const known = contentTypeFor(path);
  if (known !== "application/octet-stream") return known;
  return isBinary ? "application/octet-stream" : "text/plain; charset=utf-8";
}

async function describeFile(path: string, bytes: Uint8Array): Promise<PluginFileEntry> {
  const binary = isBinaryContent(bytes);
  // Copy into a fresh ArrayBuffer-backed view so the digest input type is concrete
  // (the tar reader yields `Uint8Array<ArrayBufferLike>`).
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

async function extractFromTarball(
  name: string,
  version: string,
  path: string,
): Promise<Uint8Array | null> {
  const res = await registryFetch(`${REGISTRY_ORIGIN}/${tarballPath(name, version)}`);
  if (!res?.ok) return null;
  const entries = await readTarGzEntries(new Uint8Array(await res.arrayBuffer()));
  const entry = entries.find((candidate) => candidate.path === path);
  return entry?.data ?? null;
}

/** The published tarball's file index, fetched lazily so the detail page never ships it. The tarball
 * is unpacked, hashed, and measured once: the result is cached in R2 (versions are immutable). */
export function getRegistryFileList(
  assets: BlobStore,
  name: string,
  version: string,
): Promise<PluginFileIndex | null> {
  return cacheJson(assets, cacheKey(name, version, "__index.json"), async () => {
    const res = await registryFetch(`${REGISTRY_ORIGIN}/${tarballPath(name, version)}`);
    if (!res?.ok) return null;
    const tarball = new Uint8Array(await res.arrayBuffer());
    const entries = await readTarGzEntries(tarball);

    const described = await Promise.all(
      entries.map((entry) => describeFile(entry.path, entry.data)),
    );
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
    return {
      files,
      totalSize,
      fileCount: described.length,
      shasum: toHex(sha1),
      integrity: `sha512-${toBase64(sha512)}`,
    };
  });
}

/** Return a bundled asset, serving from R2 when cached, else extracting from the tarball and caching it; null when absent. */
export async function getRegistryAsset(
  assets: BlobStore,
  name: string,
  version: string,
  path: string,
): Promise<ExtractedAsset | null> {
  // Derive the content type from the bytes (same rule as the file index), so a served file always
  // agrees with its index entry. Done on every path, ignoring any stale cached type.
  const key = cacheKey(name, version, path);
  const cached = await assets.get(key);
  if (cached !== null) {
    const bytes = await cached.bytes();
    return { bytes, contentType: fileContentType(path, isBinaryContent(bytes)) };
  }

  const bytes = await extractFromTarball(name, version, path);
  if (bytes === null) return null;
  const contentType = fileContentType(path, isBinaryContent(bytes));
  await assets.put(key, bytes, contentType);
  return { bytes, contentType };
}
