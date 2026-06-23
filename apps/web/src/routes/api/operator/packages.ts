import { inject } from "@brika/di";
import { PageQuery } from "@brika/registry-contract";
import { Packages } from "@brika/registry-runtime";
import { reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runOperator } from "@/server/http";

/**
 * `GET /api/operator/packages?q=&limit=&offset=` - a page of packages with moderation counts
 * (taken-down/yanked versions), newest first, optionally narrowed by a name substring. Search and
 * pagination run server-side, so the client only carries the rows it shows. Operator-gated;
 * includes packages the public catalog hides. The body is the `Page`: `{ items, total, limit,
 * offset }`.
 */
export const Route = createFileRoute("/api/operator/packages")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async () => {
          const url = new URL(request.url);
          const { limit, offset } = PageQuery.parse({
            limit: url.searchParams.get("limit") ?? undefined,
            offset: url.searchParams.get("offset") ?? undefined,
          });
          const q = url.searchParams.get("q") ?? undefined;
          return reply(await inject(Packages).list({ q, limit, offset }));
        }),
    },
  },
});
