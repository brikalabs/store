import { inject } from "@brika/di";
import { auditEntry, isOperator, type PublishIdentity } from "@brika/registry-core";
import { Audit } from "@brika/registry-runtime";
import { forbidden, HttpError, json, readBody, reply, unauthorized } from "@brika/router";
import type { z } from "zod";
import type { AppKey } from "@/i18n";
import { getCurrentUser, getSessionUserId, type SessionUser } from "@/lib/auth/auth";
import { operatorAdmins } from "@/server/env";
import { ServerT } from "@/server/i18n";
import { sessionIdentity } from "@/server/registry-identity";

/** Read + validate a JSON request body, with a locale-aware error message resolved from `messageKey`. */
export function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  messageKey: AppKey,
): Promise<T> {
  return readBody(request, schema, inject(ServerT).t(messageKey));
}

/**
 * The TanStack-Start side of the shared HTTP toolkit: a handler runner that turns a thrown
 * `HttpError` into a `Response`, plus the store's session-auth guards. Generic primitives
 * (`HttpError`, `reply`/`json`, `okOrThrow`, `readBody`) come from `@brika/router`.
 */

/** The authenticated context a console route handler runs in. */
export interface ConsoleContext {
  readonly user: SessionUser;
  readonly identity: PublishIdentity;
}

/**
 * Run a route handler body, turning a thrown {@link HttpError} into its JSON error response.
 * Any non-`HttpError` throw is a real bug and surfaces as a 500.
 */
export function runHandler(body: () => Promise<Response>): Promise<Response> {
  return Promise.resolve()
    .then(body)
    .catch((error: unknown) => {
      if (error instanceof HttpError) return reply(error.body, error.status, error.headers);
      throw error;
    });
}

/** A public, cacheable JSON read (the `/v1` contract surface). Mutations use `reply` (no-store). */
export function publicJson(data: unknown, maxAgeSeconds = 300): Response {
  return json(data, { headers: { "cache-control": `public, max-age=${maxAgeSeconds}` } });
}

/**
 * Run a `/v1` handler that requires a signed-in user (not the console identity): resolve the
 * session user id or throw 401, then run the body. Used by the social mutations.
 */
export function runUser(
  request: Request,
  body: (userId: string) => Promise<Response>,
): Promise<Response> {
  return runHandler(async () => {
    const userId = await getSessionUserId(request);
    if (userId === null) throw unauthorized("Sign in required");
    return body(userId);
  });
}

/** Resolve the session into a {@link ConsoleContext}, or throw 401. SERVER-ONLY (touches D1). */
export async function authed(request: Request): Promise<ConsoleContext> {
  const user = await getCurrentUser(request);
  if (user === null) throw unauthorized("Sign in required");
  return { user, identity: sessionIdentity(user) };
}

/**
 * Like {@link authed}, but also requires a registry operator (`REGISTRY_ADMINS`) - the gate for
 * `api/operator/*`. Throws 401 when signed out, 403 when signed in but not an operator.
 */
export async function operatorAuthed(request: Request): Promise<ConsoleContext> {
  const a = await authed(request);
  if (!isOperator(operatorAdmins(), a.identity)) throw forbidden("Not a registry operator");
  return a;
}

/** Record a console audit entry; the actor is always the caller. */
export function recordAudit(
  ctx: ConsoleContext,
  entry: {
    readonly action: string;
    readonly packageName: string;
    readonly version?: string | null;
    readonly detail?: Record<string, unknown> | null;
  },
): Promise<void> {
  return inject(Audit).record(auditEntry(ctx.identity, entry));
}

/** Run a console handler body with the session resolved first (401 if signed out), passing the {@link ConsoleContext}. */
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
