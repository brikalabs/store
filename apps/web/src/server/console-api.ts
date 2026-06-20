import type { PublishIdentity } from "@brika/registry-core";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { jsonUnauthorized } from "@/lib/http";
import { sessionIdentity } from "@/server/registry-identity";
import { type RegistryServices, registryServices } from "@/server/registry-services";
import { serverContext } from "@/server/server-context";

/** The authenticated context a console API handler runs in. */
export interface ConsoleContext {
  readonly user: SessionUser;
  readonly identity: PublishIdentity;
  readonly svc: RegistryServices;
}

/**
 * Resolve the session and build the registry service graph for a console API handler, or
 * return a 401 when there is no session. Used by every `api.*` console route so the auth +
 * composition boilerplate lives in one place: `const a = await authed(request); if ("response"
 * in a) return a.response;`. SERVER-ONLY (touches the D1 binding).
 */
export async function authed(
  request: Request,
): Promise<ConsoleContext | { readonly response: Response }> {
  const { db } = serverContext();
  const user = await getCurrentUser(request, db);
  if (user === null) return { response: jsonUnauthorized() };
  return { user, identity: sessionIdentity(user), svc: registryServices() };
}
