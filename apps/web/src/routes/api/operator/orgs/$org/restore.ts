import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate, orgStatus } from "@/lib/http";
import { operatorAuthed, runJson, unwrap } from "@/server/console-api";

/** `POST /api/operator/orgs/:org/restore` - reverse an org takedown (ORG-007). Operator-gated. */
export const Route = createFileRoute("/api/operator/orgs/$org/restore")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runJson(async () => {
          const a = await operatorAuthed(request);
          unwrap(await a.svc.orgs.restore(params.org), orgStatus);
          await a.svc.audit.record({
            action: "org_restore",
            packageName: params.org,
            version: null,
            actor: a.identity,
            detail: null,
          });
          return jsonPrivate({ ok: true, org: params.org, takedown: null });
        }),
    },
  },
});
