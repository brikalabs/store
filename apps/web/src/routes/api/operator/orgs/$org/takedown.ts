import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonBadRequest, jsonError, jsonPrivate, orgStatus } from "@/lib/http";
import { operatorAuthed } from "@/server/console-api";

const Body = z.object({ reason: z.string().min(1).max(1024) });

/**
 * `POST /api/operator/orgs/:org/takedown` - withdraw a squatted org from public listings
 * (ORG-007). Operator-gated; the reason is recorded in the audit log.
 */
export const Route = createFileRoute("/api/operator/orgs/$org/takedown")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const a = await operatorAuthed(request);
        if ("response" in a) return a.response;
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("A takedown reason is required");
        const result = await a.svc.orgs.takedown(params.org, parsed.data.reason);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_takedown",
          packageName: params.org,
          version: null,
          actor: a.identity,
          detail: { reason: parsed.data.reason },
        });
        return jsonPrivate({ ok: true, org: params.org, takedown: parsed.data.reason });
      },
    },
  },
});
