import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runOperator } from "@/server/http";

const Body = z.object({ reason: z.string().min(1).max(1024) });

/**
 * `POST /api/operator/scopes/:scope/takedown` - withdraw a squatted scope from public
 * listings (ORG-007). Operator-gated; the reason is recorded in the audit log.
 */
export const Route = createFileRoute("/api/operator/scopes/$scope/takedown")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runOperator(request, async (a) => {
          const parsed = parseBody(Body, await request.json(), "A takedown reason is required");
          okOrThrow(await a.svc.scopes.takedown(params.scope, parsed.reason));
          await a.svc.audit.record({
            action: "scope_takedown",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { reason: parsed.reason },
          });
          return reply({ ok: true, scope: params.scope, takedown: parsed.reason });
        }),
    },
  },
});
