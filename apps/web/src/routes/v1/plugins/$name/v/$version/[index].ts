import { inject } from "@brika/di";
import { notFound } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { getRegistryFileList } from "@/lib/registry/registry-assets";
import { isRegistryName } from "@/lib/registry/registry-source";
import { publicJson, runHandler } from "@/server/http";
import { BlobStore } from "@/server/ports/blob-store";

/** `GET /v1/plugins/:name/v/:version/index`: npm-style published file index (path-keyed
 * metadata + tarball aggregates), fetched lazily so the detail page never ships it. `@brika/*` names only. */
export const Route = createFileRoute("/v1/plugins/$name/v/$version/index")({
  server: {
    handlers: {
      GET: ({ params }) =>
        runHandler(async () => {
          const name = decodeURIComponent(params.name);
          if (!isRegistryName(name)) throw notFound();
          const index = await getRegistryFileList(inject(BlobStore), name, params.version);
          if (index === null) throw notFound();
          return publicJson(index);
        }),
    },
  },
});
