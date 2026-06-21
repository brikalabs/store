import type { BlobStore } from "@/server/ports/blob-store";

/**
 * Cache-aside a JSON value in a {@link BlobStore}: return the cached object when present, otherwise
 * `compute` it, store it as JSON, and return it. The caller writes only the expensive computation,
 * not the get/decode/put plumbing:
 *
 *   return cacheJson(assets, key, async () => buildIndex(name, version));
 *
 * `compute` returning null (a miss the caller cannot satisfy) is NOT cached, so a transient failure
 * does not poison the key.
 */
export async function cacheJson<T>(
  store: BlobStore,
  key: string,
  compute: () => Promise<T | null>,
): Promise<T | null> {
  const hit = await store.get(key);
  if (hit !== null) return JSON.parse(new TextDecoder().decode(await hit.bytes())) as T;

  const value = await compute();
  if (value !== null) await store.put(key, JSON.stringify(value), "application/json");
  return value;
}
