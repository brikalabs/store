import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { notFound } from "@brika/router";
import { streamBlob } from "@/server/asset-serve";

// The icon key is stable (`scope-icons/<scope>.<ext>`) and reused across re-uploads, so a long cache
// would mask a fresh upload even on reload. `no-cache` makes the browser revalidate every load; the
// content-based ETag keeps that a cheap 304 until the bytes actually change.
const ICON_CACHE_CONTROL = "no-cache";

/** Stream a scope's uploaded logo from R2 (ORG-009 GET), or throw `notFound()` when it has no icon. */
export async function streamScopeIcon(
  scope: string,
  ifNoneMatch: string | null,
): Promise<Response> {
  const iconKey = await inject(ScopeService).iconKeyOf(scope);
  if (iconKey === null) throw notFound();
  return streamBlob(iconKey, ifNoneMatch, ICON_CACHE_CONTROL);
}
