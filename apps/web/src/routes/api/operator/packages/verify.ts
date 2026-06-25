import { inject } from "@brika/di";
import { ManagementService } from "@brika/registry-core";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runOperator } from "@/server/http";

const Body = z.object({ name: z.string().min(1), verified: z.boolean() });

/**
 * `POST /api/operator/packages/verify` - toggle a package's "approved by Brika" verified badge
 * (manual moderation, per-package, not domain proof). Operator-gated; audited.
 */
export const Route = createFileRoute("/api/operator/packages/verify")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runOperator(request, async (a) => {
          const { name, verified } = await readBody(request, Body, "Invalid verify request");
          okOrThrow(await inject(ManagementService).setVerified(name, verified));
          await recordAudit(a, { action: verified ? "verify" : "unverify", packageName: name });
          return reply({ ok: true, name, verified });
        }),
    },
  },
});
