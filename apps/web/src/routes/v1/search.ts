import { SearchQuery } from "@brika/registry-contract";
import { readQuery } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { searchPlugins } from "@/lib/registry/registry";
import { publicJson, runHandler } from "@/server/http";

/** `GET /v1/search?q=&tags=&capability=&limit=&offset=&sort=` */
export const Route = createFileRoute("/v1/search")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runHandler(async () => {
          const { q, limit, offset, ...filters } = readQuery(request, SearchQuery);
          return publicJson(await searchPlugins(q, limit, offset, filters));
        }),
    },
  },
});
