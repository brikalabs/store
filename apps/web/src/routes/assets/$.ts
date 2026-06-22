import { createFileRoute } from "@tanstack/react-router";
import { streamBlob } from "@/server/asset-serve";
import { runHandler } from "@/server/http";

/** `GET /assets/<key>`: stream a public blob by key. The dev-only fallback when `ASSETS_PUBLIC_URL`
 * points here; in prod it is R2's r2.dev CDN URL and this route is unused. */
export const Route = createFileRoute("/assets/$")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runHandler(() => streamBlob(params._splat ?? "", request.headers.get("if-none-match"))),
    },
  },
});
