import { inject } from "@brika/di";
import { ScopeService, scopeProfileSchema } from "@brika/registry-core";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { recordAudit, runAuthed } from "@/server/http";
import { ServerT } from "@/server/i18n";

/** `PUT /api/scopes/:scope/profile` - set the scope's description + links (admin only; ORG-009). */
export const Route = createFileRoute("/api/scopes/$scope/profile")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const parsed = await readBody(
            request,
            scopeProfileSchema,
            inject(ServerT).t("api:invalidProfile"),
          );
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
