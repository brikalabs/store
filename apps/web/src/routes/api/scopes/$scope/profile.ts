import { inject } from "@brika/di";
import { ScopeService, scopeDescriptionSchema, scopeLinksSchema } from "@brika/registry-core";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runAuthed } from "@/server/http";

const Body = z.object({
  description: scopeDescriptionSchema.nullable(),
  links: scopeLinksSchema,
});

/** `PUT /api/scopes/:scope/profile` - set the scope's description + links (admin only; ORG-009). */
export const Route = createFileRoute("/api/scopes/$scope/profile")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const parsed = await readBody(request, Body, "Invalid description or links");
          const result = okOrThrow(
            await inject(ScopeService).setProfile(a.identity, params.scope, {
              description: parsed.description,
              links: parsed.links,
            }),
          );
          await recordAudit(a, {
            action: "scope_profile_set",
            packageName: params.scope,
            detail: { links: parsed.links.length },
          });
          return reply({ ok: true, scope: params.scope, profile: result.profile });
        }),
    },
  },
});
