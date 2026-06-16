import { createFileRoute } from "@tanstack/react-router";
import { jsonBadRequest, jsonNotFound } from "../lib/http";
import { getRegistryAsset } from "../lib/registry-assets";
import { isRegistryName, isSafeAssetPath } from "../lib/registry-source";

/**
 * `GET /v1/plugins/:name/v/:version/files/<path>` - serve a single file bundled
 * inside a registry tarball, npm-style with the version and path in the URL. The
 * icon, screenshots, readme images, and the file viewer resolve through here.
 * Version-pinned, so the response is immutable. Only `@brika/*` names use this.
 */
export const Route = createFileRoute("/v1/plugins/$name/v/$version/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = decodeURIComponent(params.name);
        if (!isRegistryName(name)) return jsonNotFound();

        const path = params._splat ?? "";
        if (!isSafeAssetPath(path)) return jsonBadRequest("invalid asset path");

        const asset = await getRegistryAsset(name, params.version, path);
        if (asset === null) return jsonNotFound();

        // Copy into a fresh ArrayBuffer-backed view so the body type is concrete
        // (the tar reader yields `Uint8Array<ArrayBufferLike>`).
        const body = new Uint8Array(asset.bytes.byteLength);
        body.set(asset.bytes);
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": asset.contentType,
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
