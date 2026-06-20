import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { operatorAuthed, parseBody, runJson, unwrap } from "@/server/console-api";

const Body = z.object({ reason: z.string().min(1).max(1024) });

/**
 * `POST /api/operator/orgs/:org/takedown` - withdraw a squatted org from public listings
 * (ORG-007). Operator-gated; the reason is recorded in the audit log.
 */
export const Route = createFileRoute("/api/operator/orgs/$org/takedown")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runJson(async () => {
          const a = await operatorAuthed(request);
          const parsed = parseBody(Body, await request.json(), "A takedown reason is required");
          unwrap(await a.svc.orgs.takedown(params.org, parsed.reason));
          await a.svc.audit.record({
            action: "org_takedown",
            packageName: params.org,
            version: null,
            actor: a.identity,
            detail: { reason: parsed.reason },
          });
          return jsonPrivate({ ok: true, org: params.org, takedown: parsed.reason });
        }),
    },
  },
});
