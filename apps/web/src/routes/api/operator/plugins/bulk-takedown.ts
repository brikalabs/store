import { inject } from "@brika/di";
import { ManagementService } from "@brika/registry-core";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readJsonBody, recordAudit, runOperator } from "@/server/http";

const Body = z.object({
  names: z.array(z.string().min(1)).min(1).max(100),
  reason: z.string().min(1).max(1024),
});

/**
 * `POST /api/operator/plugins/bulk-takedown` - take down each selected package whole (every version,
 * current and future) in one moderation sweep. Operator-gated; one audit entry per package actually
 * acted on. The body is `{ names, reason }`.
 */
export const Route = createFileRoute("/api/operator/plugins/bulk-takedown")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runOperator(request, async (a) => {
          const { names, reason } = await readJsonBody(
            request,
            Body,
            "api:bulkTakedownFieldsRequired",
          );
          const mgmt = inject(ManagementService);
          let packages = 0;
          for (const name of names) {
            const result = await mgmt.takedownPackage(name, reason);
            if (!result.ok) continue; // skip a package that no longer exists
            packages += 1;
            await recordAudit(a, {
              action: "package_takedown",
              packageName: name,
              detail: { reason, bulk: true },
            });
          }
          return reply({ ok: true, packages });
        }),
    },
  },
});
