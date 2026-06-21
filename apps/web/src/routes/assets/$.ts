import { createFileRoute } from "@tanstack/react-router";
import { streamBlob } from "@/server/asset-serve";
import { runHandler } from "@/server/http";

/**
 * `GET /assets/<key>`: stream a public object from the blob store by key. This is the worker-served
 * path that a fully-local dev points `ASSETS_PUBLIC_URL` at (so uploaded avatars resolve off the
 * LOCAL bucket); in prod `ASSETS_PUBLIC_URL` is the bucket's r2.dev URL and objects are served
 * straight from R2's CDN, so this route is not used for them.
 */
export const Route = createFileRoute("/assets/$")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runHandler(() => streamBlob(params._splat ?? "", request.headers.get("if-none-match"))),
    },
  },
});
