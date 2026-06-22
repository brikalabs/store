import { inject } from "@brika/di";
import { badRequest, notFound } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { getRegistryAsset } from "@/lib/registry/registry-assets";
import { isRegistryName, isSafeAssetPath } from "@/lib/registry/registry-source";
import { runHandler } from "@/server/http";
import { BlobStore } from "@/server/ports/blob-store";

/** `GET /v1/plugins/:name/v/:version/files/<path>`: serve one file from a registry tarball.
 * Version-pinned, so the response is immutable. `@brika/*` names only. */
export const Route = createFileRoute("/v1/plugins/$name/v/$version/files/$")({
  server: {
    handlers: {
      GET: ({ params }) =>
        runHandler(async () => {
          const name = decodeURIComponent(params.name);
          if (!isRegistryName(name)) throw notFound();

          const path = params._splat ?? "";
          if (!isSafeAssetPath(path)) throw badRequest("invalid asset path");

          const asset = await getRegistryAsset(inject(BlobStore), name, params.version, path);
          if (asset === null) throw notFound();

          // Copy into a fresh ArrayBuffer-backed view so the body type is concrete
          // (the tar reader yields `Uint8Array<ArrayBufferLike>`, not a valid BodyInit).
          const body = new Uint8Array(asset.bytes.byteLength);
          body.set(asset.bytes);
          return new Response(body, {
            status: 200,
            headers: {
              "content-type": asset.contentType,
              "cache-control": "public, max-age=31536000, immutable",
            },
          });
        }),
    },
  },
});
