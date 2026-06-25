import { inject } from "@brika/di";
import { PageQuery } from "@brika/registry-contract";
import { Downloads, Packages } from "@brika/registry-runtime";
import { readQuery, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { paginated } from "@/lib/pagination";
import { runOperator } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

const PackagesQuery = PageQuery.extend({ q: z.string().optional() });

/**
 * `GET /api/operator/packages?q=&limit=&offset=` - a page of packages with moderation counts
 * (taken-down/yanked versions) plus their install total, last-updated date, open-report count and
 * top flag reason, newest first, optionally narrowed by a name substring. Search and pagination run
 * server-side; operator-gated; includes packages the public catalog hides. The body is the standard
 * envelope: `{ items, pagination }`.
 */
export const Route = createFileRoute("/api/operator/packages")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async () => {
          const { q, limit, offset } = readQuery(request, PackagesQuery);
          const page = await inject(Packages).list({ q, limit, offset });
          const names = page.items.map((p) => p.name);
          const social = inject(SocialService);
          const [reportCounts, reasons, installs] = await Promise.all([
            social.openReportCounts(names),
            social.topReportReasons(names),
            inject(Downloads).statsFor(names),
          ]);
          const items = page.items.map((p) => ({
            ...p,
            openReports: reportCounts.get(p.name) ?? 0,
            flagReason: reasons.get(p.name) ?? null,
            installs: installs.get(p.name)?.total ?? 0,
          }));
          return reply(paginated(items, page.total, { limit, offset }));
        }),
    },
  },
});
