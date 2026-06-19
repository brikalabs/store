import { badRequest, httpError, reply } from "@brika/router";
import { regScopes } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { MemberRef, ScopeRole } from "../adapters/d1-scope-members";
import { requireWrite } from "../auth";
import { controller, route } from "../http/router";
import { isCanonicalScope, ownedBy } from "../names";
import type { Services } from "../services";

/**
 * Scope management. A scope must be created before anything publishes under it, and is
 * governed by its MEMBERS (JSR-style):
 *
 *   PUT    /-/scope/:scope                       create/claim a scope (caller becomes admin)
 *   GET    /-/scope/:scope/members               list members (any member)
 *   PUT    /-/scope/:scope/member/:provider/:id  add or re-role a member (admin)
 *   DELETE /-/scope/:scope/member/:provider/:id  remove a member (admin)
 *   POST   /-/scope/:scope/display-name          set the publisher label (admin)
 *
 * `member` may publish under the scope; `admin` may also manage members and the display
 * name. A scope always keeps at least one admin. The `reg_scopes` owner/displayName is
 * the public verified-publisher attribution; authorization is by membership.
 */

/** A scope row keyed by the caller's identity, shared by the read-then-act handlers. */
async function readScope(ctx: Services, scope: string) {
  const rows = await ctx.db.select().from(regScopes).where(eq(regScopes.scope, scope)).limit(1);
  return rows[0];
}

/** The member reference for the authenticated caller. */
function callerRef(provider: string, owner: string): MemberRef {
  return { provider, id: owner };
}

/**
 * Authenticate, then require the caller is a member of the scope (404 when the scope
 * does not exist, 403 when they are not a member). Returns the caller's identity + role.
 */
async function requireScopeMember(
  ctx: Services,
  scope: string,
  req: Request,
): Promise<{ identity: Awaited<ReturnType<typeof requireWrite>>; role: ScopeRole }> {
  const identity = await requireWrite(req, ctx.db);
  const role = await ctx.scopeMembers.roleOf(scope, callerRef(identity.provider, identity.owner));
  if (role === null) {
    if ((await readScope(ctx, scope)) === undefined) {
      throw httpError(404, `scope ${scope} does not exist`, "not_found");
    }
    throw httpError(403, `you are not a member of ${scope}`, "forbidden");
  }
  return { identity, role };
}

/** Like {@link requireScopeMember}, but the caller must be an `admin`. */
async function requireScopeAdmin(ctx: Services, scope: string, req: Request) {
  const { identity, role } = await requireScopeMember(ctx, scope, req);
  if (role !== "admin") throw httpError(403, `you are not an admin of ${scope}`, "forbidden");
  return identity;
}

/**
 * `PUT /-/scope/:scope` - create/claim a scope. Idempotent: `201` when newly created
 * (the caller is seeded as its first admin), `200` when the caller already owns it,
 * `409` when someone else does. The claim is race-safe (insert-then-reread).
 */
export async function createScope({
  params,
  req,
  ctx,
}: {
  readonly params: { readonly scope: string };
  readonly req: Request;
  readonly ctx: Services;
}): Promise<Response> {
  const { db, audit, scopeMembers } = ctx;
  const { scope } = params;
  if (!isCanonicalScope(scope)) {
    throw badRequest(
      "scope must be '@' + 2-20 lowercase letters, digits or hyphens, not starting with a hyphen",
    );
  }
  const identity = await requireWrite(req, db);
  const owner = { provider: identity.provider, id: identity.owner };

  const existing = await readScope(ctx, scope);
  if (existing !== undefined) {
    if (!ownedBy(existing, identity)) {
      throw httpError(409, `scope ${scope} is owned by ${existing.ownerId}`, "conflict");
    }
    return reply({ ok: true, scope, owner, created: false }, 200);
  }

  await db
    .insert(regScopes)
    .values({ scope, ownerProvider: identity.provider, ownerId: identity.owner })
    .onConflictDoNothing();
  const claimed = await readScope(ctx, scope);
  if (claimed === undefined || !ownedBy(claimed, identity)) {
    throw httpError(
      409,
      `scope ${scope} is owned by ${claimed?.ownerId ?? "another account"}`,
      "conflict",
    );
  }
  // The creator is the scope's first admin; membership is what authorizes publishing.
  await scopeMembers.upsert(scope, owner, "admin");
  await audit.record({
    action: "scope_create",
    packageName: scope,
    version: null,
    actor: identity,
    detail: null,
  });
  return reply({ ok: true, scope, owner, created: true }, 201);
}

/** `GET /-/scope/:scope/members` - list the scope's members (any member may view). */
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
  await requireScopeMember(ctx, scope, req);
  return reply({ ok: true, scope, members: await ctx.scopeMembers.list(scope) }, 200);
}

const MemberBody = z.object({ role: z.enum(["admin", "member"]) });

/**
 * `PUT /-/scope/:scope/member/:provider/:id` - add a member or change their role
 * (admin only). Demoting the last admin is rejected so a scope always keeps one.
 */
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
  const identity = await requireScopeAdmin(ctx, scope, req);
  const target: MemberRef = { provider, id };

  // Demoting an admin is guarded atomically so the scope keeps at least one admin even
  // under concurrent demotions; adding or promoting needs no guard.
  const current = await ctx.scopeMembers.roleOf(scope, target);
  if (current === "admin" && body.role === "member") {
    if (!(await ctx.scopeMembers.demoteFromAdmin(scope, target))) {
      throw httpError(409, `scope ${scope} must keep at least one admin`, "conflict");
    }
  } else {
    await ctx.scopeMembers.upsert(scope, target, body.role);
  }
  await ctx.audit.record({
    action: "scope_member_set",
    packageName: scope,
    version: null,
    actor: identity,
    detail: { provider, id, role: body.role },
  });
  return reply({ ok: true, scope, member: { provider, id, role: body.role } }, 200);
}

/**
 * `DELETE /-/scope/:scope/member/:provider/:id` - remove a member (admin only).
 * Removing the last admin is rejected.
 */
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
  const identity = await requireScopeAdmin(ctx, scope, req);
  const target: MemberRef = { provider, id };

  const role = await ctx.scopeMembers.roleOf(scope, target);
  if (role === null)
    throw httpError(404, `${provider}:${id} is not a member of ${scope}`, "not_found");
  // Removal is guarded atomically: the last admin cannot be removed (keeps >=1 admin).
  if (!(await ctx.scopeMembers.remove(scope, target))) {
    throw httpError(409, `scope ${scope} must keep at least one admin`, "conflict");
  }
  await ctx.audit.record({
    action: "scope_member_remove",
    packageName: scope,
    version: null,
    actor: identity,
    detail: { provider, id },
  });
  return reply({ ok: true, scope, removed: { provider, id } }, 200);
}

/**
 * Reject invisible / control / format / spoofing characters in the publisher label,
 * which is the name users are told to trust over the manifest `author`. Unicode
 * property classes catch the dangerous code points in one pass: `Cc` (C0/C1
 * controls), `Cf` (zero-width, bidi marks/overrides/isolates, ALM, soft hyphen, word
 * joiner, BOM, the invisible Tags block), `Cs` (lone surrogates), `Co` (private use);
 * plus the blank "filler" letters (U+115F/1160/3164/FFA0) that render invisible but
 * are not `Cf`. Visible-homoglyph (confusable script) detection is a deeper follow-up.
 *
 * The pattern is escape-only (every code point is a `\u`/`\p` escape, never a literal
 * glyph), so the source stays pure ASCII and no invisible character can hide in it.
 */
const UNSAFE_LABEL = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\u115f\u1160\u3164\uffa0]/u;

function hasUnsafeLabelChars(value: string): boolean {
  return UNSAFE_LABEL.test(value);
}

const DisplayNameBody = z.object({
  displayName: z
    .string()
    .min(1)
    .max(120)
    .refine((value) => !hasUnsafeLabelChars(value), "display name has disallowed characters")
    .transform((value) => value.normalize("NFC"))
    .nullable(),
});

/** `POST /-/scope/:scope/display-name` - set the verified publisher label (admin only). */
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
  const { db, audit } = ctx;
  const { scope } = params;
  const identity = await requireScopeAdmin(ctx, scope, req);

  await db
    .update(regScopes)
    .set({ displayName: body.displayName })
    .where(eq(regScopes.scope, scope));
  await audit.record({
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
    route.put({ path: "/:scope", handler: createScope }),
    route.get({ path: "/:scope/members", handler: listMembers }),
    route.put({ path: "/:scope/member/:provider/:id", body: MemberBody, handler: putMember }),
    route.delete({ path: "/:scope/member/:provider/:id", handler: deleteMember }),
    route.post({ path: "/:scope/display-name", body: DisplayNameBody, handler: setDisplayName }),
  ],
});
