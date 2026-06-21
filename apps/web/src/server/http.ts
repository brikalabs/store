import { inject, runInContext } from "@brika/di";
import { isOperator, type PublishIdentity } from "@brika/registry-core";
import { forbidden, HttpError, json, reply, unauthorized } from "@brika/router";
import { getCurrentUser, type SessionUser } from "@/lib/auth/auth";
import { Database } from "@/server/db/client";
import { operatorAdmins } from "@/server/env";
import { webProviders } from "@/server/injector";
import { sessionIdentity } from "@/server/registry-identity";

/**
 * The TanStack-Start side of the shared HTTP toolkit. The generic primitives - `HttpError`
 * and its helpers, `reply`/`json`/`created`, `okOrThrow`, `parseBody` - come straight from
 * `@brika/router`, the SAME toolkit the registry's controllers use. This file is only the
 * thin framework adapter the registry gets from the router's own dispatch loop: a handler
 * runner that turns a thrown `HttpError` into a `Response`, plus the store's session-auth
 * guards. So a web route handler reads exactly like a registry controller (auth -> parse ->
 * service -> serialize, no per-step guard).
 */

/** The authenticated context a console route handler runs in. The registry services are not
 *  threaded here: a handler `inject(ScopeService)` / `inject(Audit)` / ... directly. */
export interface ConsoleContext {
  readonly user: SessionUser;
  readonly identity: PublishIdentity;
}

/**
 * Run a route handler body, turning a thrown {@link HttpError} into its JSON error response
 * (`no-store`). The framework counterpart to the registry router's catch: handler bodies use
 * the throwing helpers ({@link authed}, `okOrThrow`, `parseBody`, `notFound`, ...) and read
 * top-to-bottom. Any non-`HttpError` throw is a real bug and surfaces as a 500.
 */
export function runHandler(body: () => Promise<Response>): Promise<Response> {
  return runInContext(webProviders, body).catch((error: unknown) => {
    if (error instanceof HttpError) return reply(error.body, error.status, error.headers);
    throw error;
  });
}

/** A public, cacheable JSON read (the `/v1` contract surface). Mutations use `reply` (no-store). */
export function publicJson(data: unknown, maxAgeSeconds = 300): Response {
  return json(data, { headers: { "cache-control": `public, max-age=${maxAgeSeconds}` } });
}

/**
 * Resolve the session + the registry service graph, or throw 401. SERVER-ONLY (touches the
 * D1 binding). Used by every console route; pair with {@link runHandler}.
 */
export async function authed(request: Request): Promise<ConsoleContext> {
  const user = await getCurrentUser(request, inject(Database).orm);
  if (user === null) throw unauthorized("Sign in required");
  return { user, identity: sessionIdentity(user) };
}

/**
 * Like {@link authed}, but also requires the session to be a registry operator (the
 * `REGISTRY_ADMINS` allowlist) - the gate for `api/operator/*`. Throws 401 when signed out,
 * 403 when signed in but not an operator. Mirrors the registry's `requireAdmin`.
 */
export async function operatorAuthed(request: Request): Promise<ConsoleContext> {
  const a = await authed(request);
  if (!isOperator(operatorAdmins(), a.identity)) throw forbidden("Not a registry operator");
  return a;
}

/**
 * Run a console handler body: in the per-request DI context AND with the session resolved first
 * (401 if signed out), passing the {@link ConsoleContext}. Folds the `runHandler` +
 * `authed(request)` that every `api/*` handler repeated - `runAuthed(request, async (a) => ...)`
 * instead of `runHandler(async () => { const a = await authed(request); ... })`. The route keeps
 * its own `({ request, params }) =>` destructure, so route params stay typed by TanStack.
 */
export function runAuthed(
  request: Request,
  body: (ctx: ConsoleContext) => Promise<Response>,
): Promise<Response> {
  return runHandler(async () => body(await authed(request)));
}

/** Like {@link runAuthed}, but also requires a registry operator (the gate for `api/operator/*`). */
export function runOperator(
  request: Request,
  body: (ctx: ConsoleContext) => Promise<Response>,
): Promise<Response> {
  return runHandler(async () => body(await operatorAuthed(request)));
}
