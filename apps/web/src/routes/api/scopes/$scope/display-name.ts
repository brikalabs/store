import { inject } from "@brika/di";
import { displayNameSchema, ScopeService } from "@brika/registry-core";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runAuthed } from "@/server/http";
import { ServerT } from "@/server/i18n";

const Body = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /api/scopes/:scope/display-name` - set the verified publisher label (admin only). */
export const Route = createFileRoute("/api/scopes/$scope/display-name")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const parsed = await readBody(request, Body, inject(ServerT).t("api:invalidDisplayName"));
          const result = okOrThrow(
            await inject(ScopeService).setDisplayName(a.identity, params.scope, parsed.displayName),
          );
          await recordAudit(a, {
            action: "scope_display_name",
            packageName: params.scope,
            detail: { displayName: parsed.displayName },
          });
          return reply({ ok: true, scope: params.scope, displayName: result.displayName });
        }),
    },
  },
});
