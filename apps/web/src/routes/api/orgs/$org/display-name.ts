import { displayNameSchema } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonBadRequest, jsonError, jsonPrivate, orgStatus } from "@/lib/http";
import { authed } from "@/server/console-api";

const Body = z.object({ displayName: displayNameSchema.nullable() });

/** `POST /api/orgs/:org/display-name` - set the verified publisher label (admin only). */
export const Route = createFileRoute("/api/orgs/$org/display-name")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid display name");
        const result = await a.svc.orgs.setDisplayName(
          a.identity,
          params.org,
          parsed.data.displayName,
        );
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_display_name",
          packageName: params.org,
          version: null,
          actor: a.identity,
          detail: { displayName: parsed.data.displayName },
        });
        return jsonPrivate({ ok: true, org: params.org, displayName: result.displayName });
      },
    },
  },
});
