/**
 * URL + content-type helpers for files bundled inside a registry tarball. Pure (no network), shared
 * by the asset routes, the file browser, and the manifest mappers.
 */

// Manifest asset kinds served from tarballs; images need an exact type so browsers render them.
// Arbitrary published files derive their type from their bytes instead.
const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

/** Content-type for a bundled asset path, defaulting to octet-stream. */
export function contentTypeFor(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Reject empty/absolute paths and parent traversal before touching storage. */
export function isSafeAssetPath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/")) return false;
  return !path.split(/[/\\]/).includes("..");
}

/** The npm-style `/v1/plugins/<name>/v/<version>` base for a published version. */
export function pluginVersionUrl(name: string, version: string): string {
  return `/v1/plugins/${encodeURIComponent(name)}/v/${encodeURIComponent(version)}`;
}

/** URL the store serves a tarball-bundled file from: version-pinned `/v1/plugins/<name>/v/<version>/files/<path>`. */
export function assetUrl(name: string, version: string, path: string): string {
  const clean = path.replace(/^\.?\//, "");
  const encodedPath = clean.split("/").map(encodeURIComponent).join("/");
  return `${pluginVersionUrl(name, version)}/files/${encodedPath}`;
}
