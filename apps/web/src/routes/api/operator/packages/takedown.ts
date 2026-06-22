import { inject } from "@brika/di";
import { ManagementService } from "@brika/registry-core";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runOperator } from "@/server/http";

const Body = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  reason: z.string().min(1).max(1024),
});

/**
 * `POST /api/operator/packages/takedown` - operator takedown of a package version: hides it from new
 * installs but keeps the bytes for pinned lockfiles, surfaces the reason. Operator-gated; audited.
 */
export const Route = createFileRoute("/api/operator/packages/takedown")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runOperator(request, async (a) => {
          const parsed = await readBody(request, Body, "name, version and reason are required");
          const { name, version, reason } = parsed;
          okOrThrow(await inject(ManagementService).takedown(name, version, reason));
          await recordAudit(a, {
            action: "takedown",
            packageName: name,
            version,
            detail: { reason },
          });
          return reply({ ok: true, name, version, takedown: reason });
        }),
    },
  },
});
