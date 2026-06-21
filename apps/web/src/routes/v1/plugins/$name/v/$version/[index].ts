import { notFound } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { getRegistryFileList } from "@/lib/registry/registry-assets";
import { isRegistryName } from "@/lib/registry/registry-source";
import { publicJson, runHandler } from "@/server/http";
import { serverContext } from "@/server/server-context";

/**
 * `GET /v1/plugins/:name/v/:version/index` - the published file index (JSON),
 * npm-style (npm serves the same at `/package/<name>/v/<version>/index`): a
 * path-keyed map of file metadata plus tarball aggregates. The file browser
 * fetches this lazily when the Supply chain tab opens, so the detail page never
 * ships it. Only `@brika/*` names use this.
 */
export const Route = createFileRoute("/v1/plugins/$name/v/$version/index")({
  server: {
    handlers: {
      GET: ({ params }) =>
        runHandler(async () => {
          const name = decodeURIComponent(params.name);
          if (!isRegistryName(name)) throw notFound();
          const index = await getRegistryFileList(serverContext().assets, name, params.version);
          if (index === null) throw notFound();
          return publicJson(index);
        }),
    },
  },
});
