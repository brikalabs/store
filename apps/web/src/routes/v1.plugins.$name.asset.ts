import { createFileRoute } from "@tanstack/react-router";
import { jsonBadRequest, jsonNotFound } from "../lib/http";
import { getRegistryAsset } from "../lib/registry-assets";
import { isRegistryName, isSafeAssetPath } from "../lib/registry-source";

/**
 * `GET /v1/plugins/:name/asset?v=<version>&path=<file>` - serve a file bundled
 * inside a registry tarball (icon, screenshot, readme image). Only `@brika/*`
 * names use this; npm plugins are served from jsDelivr. Version-pinned, so the
 * response is immutable and cached aggressively.
 */
export const Route = createFileRoute("/v1/plugins/$name/asset")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const name = decodeURIComponent(params.name);
        if (!isRegistryName(name)) return jsonNotFound();

        const url = new URL(request.url);
        const version = url.searchParams.get("v");
        const path = url.searchParams.get("path");
        if (version === null || path === null) return jsonBadRequest("v and path are required");
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
