import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { operatorAuthed } from "@/server/console-api";

/**
 * `GET /api/operator/orgs` - every organisation with its takedown state, for the operator
 * console directory. Operator-gated (403 for non-operators); not membership-filtered.
 */
export const Route = createFileRoute("/api/operator/orgs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await operatorAuthed(request);
        if ("response" in a) return a.response;
        const orgs = (await a.svc.orgs.listForOperator()).map((o) => ({
          slug: o.slug,
          displayName: o.displayName,
          takedown: o.takedown,
        }));
        return jsonPrivate({ orgs });
      },
    },
  },
});
