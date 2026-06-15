import { createFileRoute } from "@tanstack/react-router";
import { jsonOk } from "../lib/http";
import { getDeveloperPage } from "../lib/registry";

/** `GET /v1/developers/:id` (profile derived from npm) */
export const Route = createFileRoute("/v1/developers/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { profile } = await getDeveloperPage(params.id);
        return jsonOk(profile);
      },
    },
  },
});
