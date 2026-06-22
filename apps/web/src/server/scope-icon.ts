import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { notFound } from "@brika/router";
import { streamBlob } from "@/server/asset-serve";

/** Stream a scope's uploaded logo from R2 (ORG-009 GET), or throw `notFound()` when it has no icon. */
export async function streamScopeIcon(
  scope: string,
  ifNoneMatch: string | null,
): Promise<Response> {
  const iconKey = await inject(ScopeService).iconKeyOf(scope);
  if (iconKey === null) throw notFound();
  return streamBlob(iconKey, ifNoneMatch);
}
