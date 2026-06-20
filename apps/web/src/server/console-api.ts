import { isOperator, type PublishIdentity } from "@brika/registry-core";
import { getCurrentUser, type SessionUser } from "@/lib/auth/auth";
import { jsonForbidden, jsonUnauthorized } from "@/lib/http";
import { operatorAdmins } from "@/server/env";
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

/**
 * Like {@link authed}, but additionally requires the session to be a registry operator
 * (the `REGISTRY_ADMINS` allowlist) - the gate for the `api/operator/*` endpoints. Returns
 * 401 for a signed-out caller and 403 for a signed-in non-operator. Mirrors the registry's
 * `requireAdmin`, so the console and the registry agree on who may take down content.
 */
export async function operatorAuthed(
  request: Request,
): Promise<ConsoleContext | { readonly response: Response }> {
  const a = await authed(request);
  if ("response" in a) return a;
  if (!isOperator(operatorAdmins(), a.identity)) {
    return { response: jsonForbidden("Not a registry operator") };
  }
  return a;
}
