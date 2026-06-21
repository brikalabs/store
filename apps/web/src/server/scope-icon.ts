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
  const stored = await inject(BlobStore).get(iconKey);
  if (stored === null) throw notFound();
  const ext = iconKey.split(".").pop() ?? "";
  // Copy into a fresh ArrayBuffer-backed view so the body type is concrete.
  const body = new Uint8Array(stored.byteLength);
  body.set(stored);
  return new Response(body, {
    headers: {
      "content-type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=300",
    },
  });
}
