import { httpError, reply } from "@brika/router";
import { regScopes } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireWrite } from "../auth";
import { controller, route } from "../http/router";
import type { Services } from "../services";

/**
 * Scope-level settings, owner-gated (the scope's owner identity, not an admin):
 *
 *   POST /-/scope/:scope/display-name   body `{ displayName: string | null }`
 *
 * The display name is the trusted publisher label shown by the storefront
 * (e.g. "Brika Labs" for `@brika`); a manifest's free-text `author` cannot override
 * it. Only the scope owner can set it; null clears it (falls back to the owner id).
 */

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

  const rows = await db.select().from(regScopes).where(eq(regScopes.scope, scope)).limit(1);
  const row = rows[0];
  if (row === undefined) throw httpError(404, `scope ${scope} does not exist`, "not_found");
  if (row.ownerProvider !== identity.provider || row.ownerId !== identity.owner) {
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
    route.post({ path: "/:scope/display-name", body: DisplayNameBody, handler: setDisplayName }),
  ],
});
