import { createFileRoute } from "@tanstack/react-router";
import { jsonNotFound, jsonOk } from "../lib/http";
import { getRegistryFileList } from "../lib/registry-assets";
import { isRegistryName } from "../lib/registry-source";

/**
 * `GET /v1/plugins/:name/v/:version/index` - the published file list (JSON),
 * npm-style (npm serves the same at `/package/<name>/v/<version>/index`). The
 * file browser fetches this lazily when the Supply chain tab opens, so the
 * detail page never ships it. Only `@brika/*` names use this.
 */
export const Route = createFileRoute("/v1/plugins/$name/v/$version/index")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = decodeURIComponent(params.name);
        if (!isRegistryName(name)) return jsonNotFound();
        const files = await getRegistryFileList(name, params.version);
        if (files === null) return jsonNotFound();
        return jsonOk({ files });
      },
    },
  },
});
