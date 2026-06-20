import { displayNameSchema, isCanonicalScope, type ScopeErrorCode } from "@brika/registry-core";
import { badRequest, httpError, rateLimit, reply } from "@brika/router";
import { z } from "zod";
import { cf } from "../adapters/cf-rate-limiter";
import { principal, requireWrite } from "../auth";
import { controller, route } from "../http/router";

import type { Services } from "../services";

/**
 * Scope management HTTP layer. A scope must be created before anything publishes under
 * it, and is governed by its MEMBERS (JSR-style):
 *
 *   PUT    /-/scope/:scope                       create/claim a scope (caller becomes admin)
 *   GET    /-/scope/:scope/members               list members (any member)
 *   PUT    /-/scope/:scope/member/:provider/:id  add or re-role a member (admin)
 *   DELETE /-/scope/:scope/member/:provider/:id  remove a member (admin)
 *   POST   /-/scope/:scope/display-name          set the publisher label (admin)
 *
 * These handlers are thin: they validate input, resolve the caller's verified identity,
 * delegate the rules + invariants to `ctx.scopes` (the domain `ScopeService`), audit the
 * outcome, and map the result to a status. No database access or business logic here.
 */

/** Map a domain `ScopeService` rejection to its HTTP status. */
function scopeStatus(code: ScopeErrorCode): number {
  if (code === "not_found") return 404;
  if (code === "conflict") return 409;
  if (code === "too_many") return 429; // per-user scope cap reached
  return 403;
}

/** `PUT /-/scope/:scope` - create/claim a scope (201 created, 200 already yours, 409 taken). */
export async function createScope({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly scope: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { scope } = params;
  if (!isCanonicalScope(scope)) {
    throw badRequest(
      "scope must be '@' + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
    );
  }
  const identity = await requireWrite(req, ctx.tokens);
  const result = await ctx.scopes.claim(identity, scope);
  if (!result.ok) throw httpError(scopeStatus(result.code), result.message, result.code);
  if (result.created) {
    await ctx.audit.record({
      action: "scope_create",
      packageName: scope,
      version: null,
      actor: identity,
      detail: null,
    });
  }
  return reply(
    { ok: true, scope, owner: result.owner, created: result.created },
    result.created ? 201 : 200,
  );
}

/** `GET /-/scope/:scope/members` - list the scope's members (any member). */
export async function listMembers({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly scope: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = await ctx.scopes.listMembers(identity, scope);
  if (!result.ok) throw httpError(scopeStatus(result.code), result.message, result.code);
  return reply({ ok: true, scope, members: result.members }, 200);
}

const MemberBody = z.object({ role: z.enum(["admin", "member"]) });

/** `PUT /-/scope/:scope/member/:provider/:id` - add or re-role a member (admin). */
export async function putMember({
  params,
  body,
  req,
  ctx,
}: {
  readonly params: { readonly scope: string; readonly provider: string; readonly id: string };
  readonly body: z.infer<typeof MemberBody>;
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { scope, provider, id } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = await ctx.scopes.setMember(identity, scope, { provider, id }, body.role);
  if (!result.ok) throw httpError(scopeStatus(result.code), result.message, result.code);
  await ctx.audit.record({
    action: "scope_member_set",
    packageName: scope,
    version: null,
    actor: identity,
    detail: { provider, id, role: body.role },
  });
  return reply({ ok: true, scope, member: result.member }, 200);
}

/** `DELETE /-/scope/:scope/member/:provider/:id` - remove a member (admin). */
export async function deleteMember({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly scope: string; readonly provider: string; readonly id: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { scope, provider, id } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = await ctx.scopes.removeMember(identity, scope, { provider, id });
  if (!result.ok) throw httpError(scopeStatus(result.code), result.message, result.code);
  await ctx.audit.record({
    action: "scope_member_remove",
    packageName: scope,
    version: null,
    actor: identity,
    detail: { provider, id },
  });
  return reply({ ok: true, scope, removed: result.removed }, 200);
}

// The publisher label is the name users are told to trust over the manifest `author`, so
// its validation (length + no spoofing/invisible chars + NFC) lives in `@brika/registry-core`
// `displayNameSchema` and is shared with the store console, defined once.
const DisplayNameBody = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /-/scope/:scope/display-name` - set the verified publisher label (admin). */
export async function setDisplayName({
  params,
  body,
  req,
  ctx,
}: {
  readonly params: { readonly scope: string };
  readonly body: z.infer<typeof DisplayNameBody>;
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { scope } = params;
  const identity = await requireWrite(req, ctx.tokens);
  const result = await ctx.scopes.setDisplayName(identity, scope, body.displayName);
  if (!result.ok) throw httpError(scopeStatus(result.code), result.message, result.code);
  await ctx.audit.record({
    action: "scope_display_name",
    packageName: scope,
    version: null,
    actor: identity,
    detail: { displayName: body.displayName },
  });
  return reply({ ok: true, scope, displayName: body.displayName }, 200);
}

export const scopeController = controller({
  name: "scope",
  prefix: "/-/scope",
  routes: [
    // Claim is rate-limited by authenticated principal so a script cannot mass-claim
    // names (the per-user cap in ScopeService is the hard ceiling; this blunts bursts).
    route.put({
      path: "/:scope",
      middleware: [
        rateLimit({ max: 10, window: "1m", key: principal, store: cf("CLAIM_LIMITER") }),
      ],
      handler: createScope,
    }),
    route.get({ path: "/:scope/members", handler: listMembers }),
    route.put({ path: "/:scope/member/:provider/:id", body: MemberBody, handler: putMember }),
    route.delete({ path: "/:scope/member/:provider/:id", handler: deleteMember }),
    route.post({ path: "/:scope/display-name", body: DisplayNameBody, handler: setDisplayName }),
  ],
});
