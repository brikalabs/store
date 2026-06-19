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
 * Reject invisible / bidi / control characters in the publisher label: it is the
 * name users are told to trust over the manifest `author`, so zero-width chars,
 * bidi overrides (RLO/LRO), and C0/C1 controls (which could spoof another
 * publisher) are not allowed. Visible-homoglyph detection is a deeper follow-up.
 */
function hasUnsafeLabelChars(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (
      code <= 0x1f || // C0 controls
      (code >= 0x7f && code <= 0x9f) || // DEL + C1 controls
      (code >= 0x200b && code <= 0x200f) || // zero-width + LRM/RLM
      (code >= 0x202a && code <= 0x202e) || // bidi embeddings/overrides
      (code >= 0x2066 && code <= 0x2069) || // bidi isolates
      code === 0xfeff // BOM / zero-width no-break space
    ) {
      return true;
    }
  }
  return false;
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
