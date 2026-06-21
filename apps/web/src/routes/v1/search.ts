import { SearchQuery } from "@brika/registry-contract";
import { badRequest } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { searchPlugins } from "@/lib/registry/registry";
import { publicJson, runHandler } from "@/server/http";

/** `GET /v1/search?q=&limit=&offset=&sort=` */
export const Route = createFileRoute("/v1/search")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runHandler(async () => {
          const url = new URL(request.url);
          const parsed = SearchQuery.safeParse({
            q: url.searchParams.get("q") ?? undefined,
            limit: url.searchParams.get("limit") ?? undefined,
            offset: url.searchParams.get("offset") ?? undefined,
            sort: url.searchParams.get("sort") ?? undefined,
          });
          if (!parsed.success) throw badRequest("Invalid search query");
          const { q, limit, offset } = parsed.data;
          return publicJson(await searchPlugins(q, limit, offset));
        }),
    },
  },
});
