import { createFileRoute } from "@tanstack/react-router";
import { jsonNotFound, jsonOk } from "@/lib/http";
import { getPluginPage } from "@/lib/registry/registry";

/** `GET /v1/plugins/:name` (name URL-encoded, scoped names allowed) */
export const Route = createFileRoute("/v1/plugins/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const page = await getPluginPage(params.name);
        return page === null ? jsonNotFound() : jsonOk(page.detail);
      },
    },
  },
});
