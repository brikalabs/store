import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runOperator } from "@/server/http";

/** How many audit rows the console requests at once (also the server-side hard cap). */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

/**
 * `GET /api/operator/audit?limit=N` - the most recent audit entries, newest first.
 * Operator-gated. `limit` is clamped to [1, 200].
 */
export const Route = createFileRoute("/api/operator/audit")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async (a) => {
          const raw = Number(new URL(request.url).searchParams.get("limit"));
          const limit =
            Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), MAX_LIMIT) : DEFAULT_LIMIT;
          return reply({ entries: await a.svc.audit.recent(limit) });
        }),
    },
  },
});
