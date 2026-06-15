import { SearchQuery } from "@brika/registry-contract";
import { createFileRoute } from "@tanstack/react-router";
import { jsonBadRequest, jsonOk } from "../lib/http";
import { searchPlugins } from "../lib/registry";

/** `GET /v1/search?q=&limit=&offset=&sort=` */
export const Route = createFileRoute("/v1/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = SearchQuery.safeParse({
          q: url.searchParams.get("q") ?? undefined,
          limit: url.searchParams.get("limit") ?? undefined,
          offset: url.searchParams.get("offset") ?? undefined,
          sort: url.searchParams.get("sort") ?? undefined,
        });
        if (!parsed.success) return jsonBadRequest("Invalid search query");
        const { q, limit, offset } = parsed.data;
        return jsonOk(await searchPlugins(q, limit, offset));
      },
    },
  },
});
