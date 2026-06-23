import { inject } from "@brika/di";
import { ManagementService } from "@brika/registry-core";
import { readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runOperator } from "@/server/http";

const Body = z.object({
  names: z.array(z.string().min(1)).min(1).max(100),
  reason: z.string().min(1).max(1024),
});

/**
 * `POST /api/operator/packages/bulk-takedown` - take down every still-live version of each selected
 * package in one moderation sweep. Operator-gated; one audit entry per package actually acted on.
 * The body is `{ names, reason }`.
 */
export const Route = createFileRoute("/api/operator/packages/bulk-takedown")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runOperator(request, async (a) => {
          const { names, reason } = await readBody(request, Body, "names and reason are required");
          const mgmt = inject(ManagementService);
          let packages = 0;
          let versions = 0;
          for (const name of names) {
            const result = await mgmt.takedownPackage(name, reason);
            if (!result.ok) continue; // skip a package that no longer exists
            packages += 1;
            versions += result.versions;
            await recordAudit(a, {
              action: "takedown",
              packageName: name,
              detail: { reason, bulk: true },
            });
          }
          return reply({ ok: true, packages, versions });
        }),
    },
  },
});
