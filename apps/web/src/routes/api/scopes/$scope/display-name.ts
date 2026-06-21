import { inject } from "@brika/di";
import { displayNameSchema, ScopeService } from "@brika/registry-core";
import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runAuthed } from "@/server/http";
import { Audit } from "@/server/registry-services";

const Body = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /api/scopes/:scope/display-name` - set the verified publisher label (admin only). */
export const Route = createFileRoute("/api/scopes/$scope/display-name")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const parsed = parseBody(Body, await request.json(), "Invalid display name");
          const result = okOrThrow(
            await inject(ScopeService).setDisplayName(a.identity, params.scope, parsed.displayName),
          );
          await inject(Audit).record({
            action: "scope_display_name",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { displayName: parsed.displayName },
          });
          return reply({ ok: true, scope: params.scope, displayName: result.displayName });
        }),
    },
  },
});
