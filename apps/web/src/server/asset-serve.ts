import { inject } from "@brika/di";
import { notFound } from "@brika/router";
import { BlobStore } from "@/server/ports/blob-store";

const CACHE_CONTROL = "public, max-age=300";

/**
 * Stream a public object from the blob store by key, with ETag revalidation: returns `304 Not
 * Modified` (no body) when the client's `If-None-Match` matches R2's ETag, otherwise pipes R2's body
 * straight to the `Response` (no buffering). Throws `notFound()` when the object is absent.
 *
 * Shared by the scope-icon endpoint and the `/assets/<key>` route. The `/assets` route is what a
 * fully-LOCAL dev points `ASSETS_PUBLIC_URL` at, so uploaded avatars resolve through the worker off
 * the local bucket; in prod `ASSETS_PUBLIC_URL` is the bucket's r2.dev URL and this is bypassed.
 */
export async function streamBlob(key: string, ifNoneMatch: string | null): Promise<Response> {
  const stored = await inject(BlobStore).get(key);
  if (stored === null) throw notFound();

  if (stored.etag !== undefined && ifNoneMatch === stored.etag) {
    return new Response(null, {
      status: 304,
      headers: { etag: stored.etag, "cache-control": CACHE_CONTROL },
    });
  }

  const headers = new Headers({
    "content-type": stored.contentType ?? "application/octet-stream",
    "content-length": String(stored.size),
    "cache-control": CACHE_CONTROL,
    // Serve the stored type literally; never let a UA sniff a mislabelled blob into something
    // executable on the asset origin (uploads are also magic-number validated at write time).
    "x-content-type-options": "nosniff",
  });
  if (stored.etag !== undefined) headers.set("etag", stored.etag);
  return new Response(stored.body, { headers });
}
