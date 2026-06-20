import { scopeDescriptionSchema, scopeLinksSchema } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

const Body = z.object({
  description: scopeDescriptionSchema.nullable(),
  links: scopeLinksSchema,
});

/** `PUT /api/scopes/:scope/profile` - set the scope's description + links (admin only; ORG-009). */
export const Route = createFileRoute("/api/scopes/$scope/profile")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const parsed = parseBody(Body, await request.json(), "Invalid description or links");
          const result = unwrap(
            await a.svc.scopes.setProfile(a.identity, params.scope, {
              description: parsed.description,
              links: parsed.links,
            }),
          );
          await a.svc.audit.record({
            action: "scope_profile_set",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { links: parsed.links.length },
          });
          return jsonPrivate({ ok: true, scope: params.scope, profile: result.profile });
        }),
    },
  },
});
