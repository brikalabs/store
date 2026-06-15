import { env } from "cloudflare:workers";
import { readTarGzEntries, tarballPath } from "@brika/registry-core";
import { contentTypeFor, REGISTRY_ORIGIN } from "./registry-source";

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

function cacheKey(name: string, version: string, path: string): string {
  return `reg/${name}@${version}/${path}`;
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
 * Return a bundled asset, serving from R2 when cached and otherwise extracting
 * it from the tarball and caching it. Returns null when the asset is absent.
 */
export async function getRegistryAsset(
  name: string,
  version: string,
  path: string,
): Promise<ExtractedAsset | null> {
  const key = cacheKey(name, version, path);
  const cached = await env.ASSETS.get(key);
  if (cached !== null) {
    return { bytes: new Uint8Array(await cached.arrayBuffer()), contentType: contentTypeFor(path) };
  }

  const bytes = await extractFromTarball(name, version, path);
  if (bytes === null) return null;
  await env.ASSETS.put(key, bytes, {
    httpMetadata: { contentType: contentTypeFor(path) },
  });
  return { bytes, contentType: contentTypeFor(path) };
}

/** Read a bundled text file (readme, `store.json`) from the tarball, or null. */
export async function getRegistryAssetText(
  name: string,
  version: string,
  path: string,
): Promise<string | null> {
  const asset = await getRegistryAsset(name, version, path);
  return asset === null ? null : new TextDecoder().decode(asset.bytes);
}
