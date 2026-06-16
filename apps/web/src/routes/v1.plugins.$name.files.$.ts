import { createFileRoute } from "@tanstack/react-router";
import { jsonBadRequest, jsonNotFound } from "../lib/http";
import { getRegistryAsset } from "../lib/registry-assets";
import { isRegistryName, isSafeAssetPath } from "../lib/registry-source";

/**
 * `GET /v1/plugins/:name/files/<version>/<path>` - serve a file bundled inside a
 * registry tarball, npm/unpkg style with the version and path in the URL (not a
 * query string). The icon, screenshots, readme images, and the file browser all
 * resolve through here. Version-pinned, so the response is immutable and cached
 * aggressively. Only `@brika/*` names use this; npm plugins come from jsDelivr.
 */
export const Route = createFileRoute("/v1/plugins/$name/files/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const name = decodeURIComponent(params.name);
        if (!isRegistryName(name)) return jsonNotFound();

        // The splat is `<version>/<path...>`; split on the first slash.
        const splat = params._splat ?? "";
        const slash = splat.indexOf("/");
        if (slash <= 0) return jsonBadRequest("version and path are required");
        const version = splat.slice(0, slash);
        const path = splat.slice(slash + 1);
        if (!isSafeAssetPath(path)) return jsonBadRequest("invalid asset path");

        const asset = await getRegistryAsset(name, version, path);
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
