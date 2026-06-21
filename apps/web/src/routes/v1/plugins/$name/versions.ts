import { notFound } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { getPluginVersions } from "@/lib/registry/registry";
import { publicJson, runHandler } from "@/server/http";

/** `GET /v1/plugins/:name/versions` */
export const Route = createFileRoute("/v1/plugins/$name/versions")({
  server: {
    handlers: {
      GET: ({ params }) =>
        runHandler(async () => {
          const versions = await getPluginVersions(params.name);
          if (versions === null) throw notFound();
          return publicJson(versions);
        }),
    },
  },
});
