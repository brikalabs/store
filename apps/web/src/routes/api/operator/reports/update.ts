import { inject } from "@brika/di";
import { notFound, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runOperator } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

const Body = z.object({
  id: z.string().min(1),
  status: z.enum(["resolved", "dismissed"]),
});

/**
 * `POST /api/operator/reports/update` - resolve or dismiss an open report, clearing it from the
 * queue (and from the package's report count). Operator-gated; recorded in the audit log.
 */
export const Route = createFileRoute("/api/operator/reports/update")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runOperator(request, async (a) => {
          const { id, status } = await readBody(request, Body, "id and status are required");
          const pluginName = await inject(SocialService).setReportStatus(id, status);
          if (pluginName === null) throw notFound("Report not found or already handled");
          await recordAudit(a, {
            action: `report_${status}`,
            packageName: pluginName,
            detail: { reportId: id },
          });
          return reply({ ok: true });
        }),
    },
  },
});
