import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runOperator } from "@/server/http";

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
          const parsed = await readBody(request, Body, "A takedown reason is required");
          okOrThrow(await inject(ScopeService).takedown(params.scope, parsed.reason));
          await recordAudit(a, {
            action: "scope_takedown",
            packageName: params.scope,
            detail: { reason: parsed.reason },
          });
          return reply({ ok: true, scope: params.scope, takedown: parsed.reason });
        }),
    },
  },
});
