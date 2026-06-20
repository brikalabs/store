import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { operatorAuthed, runJson } from "@/server/console-api";

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
        runJson(async () => {
          const a = await operatorAuthed(request);
          const raw = Number(new URL(request.url).searchParams.get("limit"));
          const limit =
            Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), MAX_LIMIT) : DEFAULT_LIMIT;
          return jsonPrivate({ entries: await a.svc.audit.recent(limit) });
        }),
    },
  },
});
