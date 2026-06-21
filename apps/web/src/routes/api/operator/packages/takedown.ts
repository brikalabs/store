import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { operatorAuthed, runHandler } from "@/server/http";

const Body = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  reason: z.string().min(1).max(1024),
});

/**
 * `POST /api/operator/packages/takedown` - operator takedown of a package version (hides it
 * from new installs, keeps the bytes for pinned lockfiles, surfaces the reason). The
 * ManagementService is operator-gated here (not scope ownership); the reason is audited.
 */
export const Route = createFileRoute("/api/operator/packages/takedown")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runHandler(async () => {
          const a = await operatorAuthed(request);
          const parsed = parseBody(
            Body,
            await request.json(),
            "name, version and reason are required",
          );
          const { name, version, reason } = parsed;
          okOrThrow(await a.svc.management.takedown(name, version, reason));
          await a.svc.audit.record({
            action: "takedown",
            packageName: name,
            version,
            actor: a.identity,
            detail: { reason },
          });
          return reply({ ok: true, name, version, takedown: reason });
        }),
    },
  },
});
