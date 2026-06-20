import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { operatorAuthed, runJson } from "@/server/console-api";

/**
 * `GET /api/operator/packages` - every package with moderation counts (taken-down/yanked
 * versions), newest first. Operator-gated; includes packages the public catalog hides.
 */
export const Route = createFileRoute("/api/operator/packages")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runJson(async () => {
          const a = await operatorAuthed(request);
          return jsonPrivate({ packages: await a.svc.listPackages() });
        }),
    },
  },
});
