import { createFileRoute } from "@tanstack/react-router";
import { jsonNotFound, jsonOk } from "@/lib/http";
import { getPluginVersions } from "@/lib/registry";

/** `GET /v1/plugins/:name/versions` */
export const Route = createFileRoute("/v1/plugins/$name/versions")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const versions = await getPluginVersions(params.name);
        return versions === null ? jsonNotFound() : jsonOk(versions);
      },
    },
  },
});
