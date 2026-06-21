import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { notFound } from "@brika/router";
import { streamBlob } from "@/server/asset-serve";

/**
 * Stream a scope's uploaded logo from R2 (ORG-009 GET). Throws `notFound()` (a 404, mapped by
 * `runHandler`) when the scope has no icon pointer, then delegates to {@link streamBlob} for the
 * ETag/304 revalidation and the streamed body.
 */
export async function streamScopeIcon(
  scope: string,
  ifNoneMatch: string | null,
): Promise<Response> {
  const iconKey = await inject(ScopeService).iconKeyOf(scope);
  if (iconKey === null) throw notFound();
  return streamBlob(iconKey, ifNoneMatch);
}
