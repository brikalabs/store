import { inject } from "@brika/di";
import { PageQuery } from "@brika/registry-contract";
import { readQuery, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { paginated } from "@/lib/pagination";
import { REPORT_REASON_KEYS } from "@/lib/reports";
import { runOperator } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

const STATUSES = ["open", "resolved", "dismissed", "all"] as const;

const ReportsQuery = PageQuery.extend({
  q: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  reason: z
    .string()
    .optional()
    .transform((value) => REPORT_REASON_KEYS.find((k) => k === value)),
  status: z
    .string()
    .optional()
    .transform((value) => STATUSES.find((s) => s === value) ?? "open"),
});

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
          const { q, reason, status, limit, offset } = readQuery(request, ReportsQuery);

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
