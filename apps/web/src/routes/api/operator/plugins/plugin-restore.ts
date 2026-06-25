import { inject } from "@brika/di";
import { ManagementService } from "@brika/registry-core";
import { okOrThrow, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readJsonBody, recordAudit, runOperator } from "@/server/http";

const Body = z.object({ name: z.string().min(1) });

/** `POST /api/operator/plugins/plugin-restore` - reverse a whole-package takedown. Operator-gated. */
export const Route = createFileRoute("/api/operator/plugins/plugin-restore")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runOperator(request, async (a) => {
          const { name } = await readJsonBody(request, Body, "api:restoreFieldsRequired");
          okOrThrow(await inject(ManagementService).restorePackage(name));
          await recordAudit(a, { action: "package_restore", packageName: name });
          return reply({ ok: true, name, takedown: null });
        }),
    },
  },
});
