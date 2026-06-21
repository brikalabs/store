import { displayNameSchema } from "@brika/registry-core";
import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authed, runHandler } from "@/server/http";

const Body = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /api/scopes/:scope/display-name` - set the verified publisher label (admin only). */
export const Route = createFileRoute("/api/scopes/$scope/display-name")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runHandler(async () => {
          const a = await authed(request);
          const parsed = parseBody(Body, await request.json(), "Invalid display name");
          const result = okOrThrow(
            await a.svc.scopes.setDisplayName(a.identity, params.scope, parsed.displayName),
          );
          await a.svc.audit.record({
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
