import { inject } from "@brika/di";
import { ManagementService } from "@brika/registry-core";
import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runOperator } from "@/server/http";
import { Audit } from "@/server/registry-services";

const Body = z.object({ name: z.string().min(1), version: z.string().min(1) });

/** `POST /api/operator/packages/restore` - reverse a version takedown. Operator-gated. */
export const Route = createFileRoute("/api/operator/packages/restore")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runOperator(request, async (a) => {
          const parsed = parseBody(Body, await request.json(), "name and version are required");
          const { name, version } = parsed;
          okOrThrow(await inject(ManagementService).restore(name, version));
          await inject(Audit).record({
            action: "restore",
            packageName: name,
            version,
            actor: a.identity,
            detail: null,
          });
          return reply({ ok: true, name, version, takedown: null });
        }),
    },
  },
});
