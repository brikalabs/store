import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { notFound } from "@brika/router";
import { CONTENT_TYPE_BY_EXT } from "@/lib/scope-icon";
import { BlobStore } from "@/server/ports/blob-store";

/**
 * Stream a scope's uploaded logo from R2 (ORG-009 GET). Throws `notFound()` (a 404, mapped by
 * `runHandler`) when the scope has no icon pointer or the staged blob is gone, exactly as a
 * registry controller signals a miss. Keeps the R2 read off the route handler.
 */
export async function streamScopeIcon(scope: string): Promise<Response> {
  const iconKey = await inject(ScopeService).iconKeyOf(scope);
  if (iconKey === null) throw notFound();
  const stored = await inject(BlobStore).getStream(iconKey);
  if (stored === null) throw notFound();
  const ext = iconKey.split(".").pop() ?? "";
  // Pipe R2's body straight to the Response: no buffering the whole icon into memory.
  return new Response(stored.body, {
    headers: {
      "content-type": CONTENT_TYPE_BY_EXT[ext] ?? stored.contentType ?? "application/octet-stream",
      "content-length": String(stored.size),
      "cache-control": "public, max-age=300",
    },
  });
}
