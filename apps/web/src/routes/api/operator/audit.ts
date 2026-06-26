import { inject } from "@brika/di";
import { PageQuery } from "@brika/registry-contract";
import { Audit } from "@brika/registry-runtime";
import { readQuery, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { paginated } from "@/lib/pagination";
import { runOperator } from "@/server/http";

const AuditQuery = PageQuery.extend({
  action: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
});

/**
 * `GET /api/operator/audit?limit=&offset=&action=` - a page of audit entries, newest first,
 * optionally narrowed to one action type. Operator-gated. `limit` is clamped to [1, 100] by
 * `PageQuery`. The body is the standard envelope plus the distinct `actions` list (for the type
 * filter): `{ items, pagination, actions }`.
 */
export const Route = createFileRoute("/api/operator/audit")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async () => {
          const { action, limit, offset } = readQuery(request, AuditQuery);
          const audit = inject(Audit);
          const [page, actions] = await Promise.all([
            audit.recentPage(limit, offset, action),
            audit.distinctActions(),
          ]);
          return reply({ ...paginated(page.items, page.total, { limit, offset }), actions });
        }),
    },
  },
});
