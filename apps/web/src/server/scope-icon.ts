import { inject } from "@brika/di";
import { CONTENT_TYPE_BY_EXT } from "@/lib/scope-icon";
import { BlobStore } from "@/server/blob-store";
import { Registry } from "@/server/registry-services";

/**
 * Stream a scope's uploaded logo from R2 (ORG-009 GET). Returns a 404 `Response` when the scope
 * has no icon pointer or the staged blob is gone. Keeps the R2 read off the route handler.
 */
export async function streamScopeIcon(scope: string): Promise<Response> {
  const iconKey = await inject(Registry).graph.scopes.iconKeyOf(scope);
  if (iconKey === null) return new Response("Not found", { status: 404 });
  const stored = await inject(BlobStore).get(iconKey);
  if (stored === null) return new Response("Not found", { status: 404 });
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
