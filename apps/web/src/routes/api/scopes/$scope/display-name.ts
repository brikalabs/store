import { displayNameSchema } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

const Body = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /api/scopes/:scope/display-name` - set the verified publisher label (admin only). */
export const Route = createFileRoute("/api/scopes/$scope/display-name")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const parsed = parseBody(Body, await request.json(), "Invalid display name");
          const result = unwrap(
            await a.svc.scopes.setDisplayName(a.identity, params.scope, parsed.displayName),
          );
          await a.svc.audit.record({
            action: "scope_display_name",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { displayName: parsed.displayName },
          });
          return jsonPrivate({ ok: true, scope: params.scope, displayName: result.displayName });
        }),
    },
  },
});
