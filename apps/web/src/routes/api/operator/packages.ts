import { inject } from "@brika/di";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runOperator } from "@/server/http";
import { ListPackages } from "@/server/registry-services";

/**
 * `GET /api/operator/packages` - every package with moderation counts (taken-down/yanked
 * versions), newest first. Operator-gated; includes packages the public catalog hides.
 */
export const Route = createFileRoute("/api/operator/packages")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async () => {
          return reply({ packages: await inject(ListPackages)() });
        }),
    },
  },
});
