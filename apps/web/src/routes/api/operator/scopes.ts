import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { operatorAuthed, runJson } from "@/server/console-api";

/**
 * `GET /api/operator/scopes` - every scope with its takedown state, for the operator
 * console directory. Operator-gated (403 for non-operators); not membership-filtered.
 */
export const Route = createFileRoute("/api/operator/scopes")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runJson(async () => {
          const a = await operatorAuthed(request);
          const scopes = (await a.svc.scopes.listForOperator()).map((s) => ({
            scope: s.scope,
            displayName: s.displayName,
            takedown: s.takedown,
          }));
          return jsonPrivate({ scopes });
        }),
    },
  },
});
