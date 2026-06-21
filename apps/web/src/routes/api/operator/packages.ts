import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { operatorAuthed, runHandler } from "@/server/http";

/**
 * `GET /api/operator/packages` - every package with moderation counts (taken-down/yanked
 * versions), newest first. Operator-gated; includes packages the public catalog hides.
 */
export const Route = createFileRoute("/api/operator/packages")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runHandler(async () => {
          const a = await operatorAuthed(request);
          return reply({ packages: await a.svc.listPackages() });
        }),
    },
  },
});
