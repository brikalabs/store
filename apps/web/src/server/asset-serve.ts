import { inject } from "@brika/di";
import { notFound } from "@brika/router";
import { BlobStore } from "@/server/ports/blob-store";

const CACHE_CONTROL = "public, max-age=300";

/**
 * Stream a public object from the blob store by key, with ETag revalidation: `304` when the client's
 * `If-None-Match` matches, otherwise pipes the body unbuffered. Throws `notFound()` when absent.
 *
 * `cacheControl` defaults to a 5-minute cache (fine for content-addressed keys). Pass a revalidating
 * policy (e.g. `no-cache`) for a stable key whose bytes can change in place, or a stale upload stays
 * masked behind the browser cache.
 */
export async function streamBlob(
  key: string,
  ifNoneMatch: string | null,
  cacheControl: string = CACHE_CONTROL,
): Promise<Response> {
  const stored = await inject(BlobStore).get(key);
  if (stored === null) throw notFound();

  if (stored.etag !== undefined && ifNoneMatch === stored.etag) {
    return new Response(null, {
      status: 304,
      headers: { etag: stored.etag, "cache-control": cacheControl },
    });
  }

  const headers = new Headers({
    "content-type": stored.contentType ?? "application/octet-stream",
    "content-length": String(stored.size),
    "cache-control": cacheControl,
    // Serve the stored type literally; never let a UA sniff a mislabelled blob into something
    // executable on the asset origin (uploads are also magic-number validated at write time).
    "x-content-type-options": "nosniff",
  });
  if (stored.etag !== undefined) headers.set("etag", stored.etag);
  return new Response(stored.body, { headers });
}
