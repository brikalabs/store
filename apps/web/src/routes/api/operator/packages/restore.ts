import { inject } from "@brika/di";
import { ManagementService } from "@brika/registry-core";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runOperator } from "@/server/http";

const Body = z.object({ name: z.string().min(1), version: z.string().min(1) });

/** `POST /api/operator/packages/restore` - reverse a version takedown. Operator-gated. */
export const Route = createFileRoute("/api/operator/packages/restore")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runOperator(request, async (a) => {
          const parsed = await readBody(request, Body, "name and version are required");
          const { name, version } = parsed;
          okOrThrow(await inject(ManagementService).restore(name, version));
          await recordAudit(a, { action: "restore", packageName: name, version });
          return reply({ ok: true, name, version, takedown: null });
        }),
    },
  },
});
