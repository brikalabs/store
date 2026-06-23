import { inject } from "@brika/di";
import { PageQuery } from "@brika/registry-contract";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { paginated } from "@/lib/pagination";
import { REPORT_REASON_KEYS } from "@/lib/reports";
import { runOperator } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

const STATUSES = ["open", "resolved", "dismissed", "all"] as const;

/**
 * `GET /api/operator/reports?status=&reason=&q=&limit=&offset=` - a page of the moderation queue
 * (newest first) plus per-status counts for the filter chips. `status` defaults to `open`; `reason`
 * is a category key; `q` searches plugin name, reporter, and details. Operator-gated. The body is
 * the standard envelope plus `counts`: `{ items, pagination, counts }`.
 */
export const Route = createFileRoute("/api/operator/reports")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async () => {
          const url = new URL(request.url);
          const { limit, offset } = PageQuery.parse({
            limit: url.searchParams.get("limit") ?? undefined,
            offset: url.searchParams.get("offset") ?? undefined,
          });
          const q = url.searchParams.get("q")?.trim() || undefined;
          const reason = REPORT_REASON_KEYS.find((k) => k === url.searchParams.get("reason"));
          const status = STATUSES.find((s) => s === url.searchParams.get("status")) ?? "open";

          const social = inject(SocialService);
          const [page, counts] = await Promise.all([
            social.listReports({ status, reason, q, limit, offset }),
            social.reportStatusCounts({ reason, q }),
          ]);
          return reply({ ...paginated(page.items, page.total, { limit, offset }), counts });
        }),
    },
  },
});
