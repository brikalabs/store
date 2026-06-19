import { badRequest, httpError, reply } from "@brika/router";
import { regScopes } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireWrite } from "../auth";
import { controller, route } from "../http/router";
import { isCanonicalScope, ownedBy } from "../names";
import type { Services } from "../services";

/**
 * Scope management, owner-gated (the scope's owner identity, not an admin):
 *
 *   PUT  /-/scope/:scope                create/claim a scope for the caller
 *   POST /-/scope/:scope/display-name   body `{ displayName: string | null }`
 *
 * A scope must be explicitly created before anything can be published under it (the
 * publish ownership gate rejects an unknown scope). Creation is the only way a scope is
 * claimed; whoever creates it owns it. The display name is the trusted publisher label
 * shown by the storefront (e.g. "Brika Labs" for `@brika`); a manifest's free-text
 * `author` cannot override it. Only the owner can set it; null clears it.
 */

/** A scope row keyed by the caller's identity, shared by the read-then-act handlers. */
async function readScope(ctx: Services, scope: string) {
  const rows = await ctx.db.select().from(regScopes).where(eq(regScopes.scope, scope)).limit(1);
  return rows[0];
}

/**
 * `PUT /-/scope/:scope` - create/claim a scope. Idempotent: `201` when newly created,
 * `200` when the caller already owns it, `409` when someone else does. The claim is
 * race-safe (insert-then-reread): `onConflictDoNothing` keeps the first writer's row, so
 * two identities racing to create the same scope resolve to one owner and the loser gets
 * `409` rather than a wrongly-granted claim.
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
  const { db, audit } = ctx;
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
  await audit.record({
    action: "scope_create",
    packageName: scope,
    version: null,
    actor: identity,
    detail: null,
  });
  return reply({ ok: true, scope, owner, created: true }, 201);
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
  const identity = await requireWrite(req, db);

  const row = await readScope(ctx, scope);
  if (row === undefined) throw httpError(404, `scope ${scope} does not exist`, "not_found");
  if (!ownedBy(row, identity)) {
    throw httpError(403, `scope ${scope} is owned by ${row.ownerId}`, "forbidden");
  }

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
    route.post({ path: "/:scope/display-name", body: DisplayNameBody, handler: setDisplayName }),
  ],
});
