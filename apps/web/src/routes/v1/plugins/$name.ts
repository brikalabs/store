import { notFound } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { getPluginPage } from "@/lib/registry/registry";
import { publicJson, runHandler } from "@/server/http";

/** `GET /v1/plugins/:name` (name URL-encoded, scoped names allowed) */
export const Route = createFileRoute("/v1/plugins/$name")({
  server: {
    handlers: {
      GET: ({ params }) =>
        runHandler(async () => {
          const page = await getPluginPage(params.name);
          if (page === null) throw notFound();
          return publicJson(page.detail);
        }),
    },
  },
});
