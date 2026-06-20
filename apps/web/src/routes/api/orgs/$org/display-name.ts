import { displayNameSchema } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

const Body = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /api/orgs/:org/display-name` - set the verified publisher label (admin only). */
export const Route = createFileRoute("/api/orgs/$org/display-name")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const parsed = parseBody(Body, await request.json(), "Invalid display name");
          const result = unwrap(
            await a.svc.orgs.setDisplayName(a.identity, params.org, parsed.displayName),
          );
          await a.svc.audit.record({
            action: "org_display_name",
            packageName: params.org,
            version: null,
            actor: a.identity,
            detail: { displayName: parsed.displayName },
          });
          return jsonPrivate({ ok: true, org: params.org, displayName: result.displayName });
        }),
    },
  },
});
