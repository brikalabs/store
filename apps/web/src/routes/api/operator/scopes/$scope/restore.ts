import { okOrThrow, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runOperator } from "@/server/http";

/** `POST /api/operator/scopes/:scope/restore` - reverse a scope takedown (ORG-007). Operator-gated. */
export const Route = createFileRoute("/api/operator/scopes/$scope/restore")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runOperator(request, async (a) => {
          okOrThrow(await a.svc.scopes.restore(params.scope));
          await a.svc.audit.record({
            action: "scope_restore",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: null,
          });
          return reply({ ok: true, scope: params.scope, takedown: null });
        }),
    },
  },
});
