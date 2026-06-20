import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonPrivate, orgStatus } from "@/lib/http";
import { operatorAuthed } from "@/server/console-api";

/** `POST /api/operator/orgs/:org/restore` - reverse an org takedown (ORG-007). Operator-gated. */
export const Route = createFileRoute("/api/operator/orgs/$org/restore")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const a = await operatorAuthed(request);
        if ("response" in a) return a.response;
        const result = await a.svc.orgs.restore(params.org);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_restore",
          packageName: params.org,
          version: null,
          actor: a.identity,
          detail: null,
        });
        return jsonPrivate({ ok: true, org: params.org, takedown: null });
      },
    },
  },
});
