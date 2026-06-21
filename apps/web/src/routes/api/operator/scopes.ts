import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runOperator } from "@/server/http";

/**
 * `GET /api/operator/scopes` - every scope with its takedown state, for the operator
 * console directory. Operator-gated (403 for non-operators); not membership-filtered.
 */
export const Route = createFileRoute("/api/operator/scopes")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async () => {
          const scopes = (await inject(ScopeService).listForOperator()).map((s) => ({
            scope: s.scope,
            displayName: s.displayName,
            takedown: s.takedown,
          }));
          return reply({ scopes });
        }),
    },
  },
});
