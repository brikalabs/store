import { isOperator, type PublishIdentity } from "@brika/registry-core";
import type { z } from "zod";
import { getCurrentUser, type SessionUser } from "@/lib/auth/auth";
import { jsonError } from "@/lib/http";
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
 * A failure a console handler can throw to short-circuit to a JSON error response. Lets the
 * handler body read top-to-bottom (auth, parse, call, respond) with no `if`-guard after each
 * step: the guards live in the helpers below, which throw this, and {@link jsonHandler}
 * turns it into the response. Any other throw is a real bug and surfaces as a 500.
 */
export class JsonError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Run a console handler body, turning a thrown {@link JsonError} into its JSON error response.
 * Each `api.*` handler wraps its body in this - `METHOD: ({ request, params }) => runJson(async
 * () => { ... })` - so the body can use the throwing helpers ({@link authed},
 * {@link operatorAuthed}, {@link unwrap}, {@link parseBody}) and read top-to-bottom with no
 * guard `if`s. The body is wrapped (not the handler) so the route keeps TanStack's typed
 * `params`. Any non-{@link JsonError} throw is a real bug and surfaces as a 500.
 */
export function runJson(body: () => Promise<Response>): Promise<Response> {
  return body().catch((error: unknown) => {
    if (error instanceof JsonError) return jsonError(error.status, error.message);
    throw error;
  });
}

/**
 * Resolve the session + the registry service graph, or throw {@link JsonError} 401. SERVER-
 * ONLY (touches the D1 binding). Used by every console route; pair with {@link jsonHandler}.
 */
export async function authed(request: Request): Promise<ConsoleContext> {
  const { db } = serverContext();
  const user = await getCurrentUser(request, db);
  if (user === null) throw new JsonError(401, "Sign in required");
  return { user, identity: sessionIdentity(user), svc: registryServices() };
}

/**
 * Like {@link authed}, but also requires the session to be a registry operator (the
 * `REGISTRY_ADMINS` allowlist) - the gate for `api/operator/*`. Throws 401 when signed out,
 * 403 when signed in but not an operator. Mirrors the registry's `requireAdmin`.
 */
export async function operatorAuthed(request: Request): Promise<ConsoleContext> {
  const a = await authed(request);
  if (!isOperator(operatorAdmins(), a.identity)) {
    throw new JsonError(403, "Not a registry operator");
  }
  return a;
}

/**
 * Unwrap a domain result, or throw {@link JsonError} with the code mapped to a status
 * (`orgStatus`, `manageStatus`). Collapses the `if (!result.ok) return jsonError(...)` guard
 * every handler otherwise repeats into `const { x } = unwrap(await svc.foo(), orgStatus)`.
 */
export function unwrap<R extends { readonly ok: true }, C extends string>(
  result: R | { readonly ok: false; readonly code: C; readonly message: string },
  toStatus: (code: C) => number,
): R {
  if (!result.ok) throw new JsonError(toStatus(result.code), result.message);
  return result;
}

/** Parse a request body against `schema`, or throw {@link JsonError} 400 with `message`. */
export function parseBody<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new JsonError(400, message);
  return parsed.data;
}
