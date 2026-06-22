import type { BlobStore } from "@/server/ports/blob-store";

/**
 * Cache-aside a JSON value in a {@link BlobStore}: return the cached object, else `compute` it,
 * store it as JSON, and return it. A null `compute` result is NOT cached, so a transient failure
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
