import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { notFound } from "@brika/router";
import { BlobStore } from "@/server/ports/blob-store";

const ICON_CACHE_CONTROL = "public, max-age=300";

/**
 * Stream a scope's uploaded logo from R2 (ORG-009 GET). Throws `notFound()` (a 404, mapped by
 * `runHandler`) when the scope has no icon pointer or the staged blob is gone, exactly as a
 * registry controller signals a miss. Keeps the R2 read off the route handler.
 *
 * Serves an `ETag` (R2's, the content's identity) so a client can revalidate: when its
 * `If-None-Match` matches, returns `304 Not Modified` without re-sending the body - the icon is
 * mutable (a scope can replace it), so this beats a longer max-age while staying fresh on change.
 */
export async function streamScopeIcon(
  scope: string,
  ifNoneMatch: string | null,
): Promise<Response> {
  const iconKey = await inject(ScopeService).iconKeyOf(scope);
  if (iconKey === null) throw notFound();
  const stored = await inject(BlobStore).get(iconKey);
  if (stored === null) throw notFound();

  if (stored.etag !== undefined && ifNoneMatch === stored.etag) {
    // Unchanged: don't read the body (R2's stream is left unconsumed, no bytes transferred).
    return new Response(null, {
      status: 304,
      headers: { etag: stored.etag, "cache-control": ICON_CACHE_CONTROL },
    });
  }

  // Pipe R2's body straight to the Response (no buffering), with the content type stored at upload.
  const headers = new Headers({
    "content-type": stored.contentType ?? "application/octet-stream",
    "content-length": String(stored.size),
    "cache-control": ICON_CACHE_CONTROL,
  });
  if (stored.etag !== undefined) headers.set("etag", stored.etag);
  return new Response(stored.body, { headers });
}
