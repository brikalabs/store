import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { operatorAuthed, parseBody, runJson, unwrap } from "@/server/console-api";

const Body = z.object({ reason: z.string().min(1).max(1024) });

/**
 * `POST /api/operator/scopes/:scope/takedown` - withdraw a squatted scope from public
 * listings (ORG-007). Operator-gated; the reason is recorded in the audit log.
 */
export const Route = createFileRoute("/api/operator/scopes/$scope/takedown")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runJson(async () => {
          const a = await operatorAuthed(request);
          const parsed = parseBody(Body, await request.json(), "A takedown reason is required");
          unwrap(await a.svc.scopes.takedown(params.scope, parsed.reason));
          await a.svc.audit.record({
            action: "scope_takedown",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { reason: parsed.reason },
          });
          return jsonPrivate({ ok: true, scope: params.scope, takedown: parsed.reason });
        }),
    },
  },
});
