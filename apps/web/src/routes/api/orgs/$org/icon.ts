import { createFileRoute } from "@tanstack/react-router";
import { jsonBadRequest, jsonPrivate, orgStatus } from "@/lib/http";
import { authed, runJson, unwrap } from "@/server/console-api";
import { registryServices } from "@/server/registry-services";
import { serverContext } from "@/server/server-context";

/** Allowed raster logo types -> file extension. SVG is excluded (script-in-SVG surface). */
const ICON_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_ICON_BYTES = 512 * 1024; // 512 KiB
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/**
 * Org logo (ORG-009):
 *   GET    /api/orgs/:org/icon  public - stream the uploaded logo (404 when none)
 *   POST   /api/orgs/:org/icon  admin  - upload a raster logo (<=512 KiB) to R2
 *   DELETE /api/orgs/:org/icon  admin  - clear the logo (falls back to the generated avatar)
 */
export const Route = createFileRoute("/api/orgs/$org/icon")({
  server: {
    handlers: {
      GET: ({ params }) =>
        runJson(async () => {
          const iconKey = await registryServices().orgs.iconKeyOf(params.org);
          if (iconKey === null) return new Response("Not found", { status: 404 });
          const stored = await serverContext().assets.get(iconKey);
          if (stored === null) return new Response("Not found", { status: 404 });
          const ext = iconKey.split(".").pop() ?? "";
          // Copy into a fresh ArrayBuffer-backed view so the body type is concrete.
          const body = new Uint8Array(stored.byteLength);
          body.set(stored);
          return new Response(body, {
            headers: {
              "content-type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
              "cache-control": "public, max-age=300",
            },
          });
        }),
      POST: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const type = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
          const ext = ICON_TYPES[type];
          if (ext === undefined) return jsonBadRequest("Logo must be a PNG, JPEG, or WebP image");
          const bytes = new Uint8Array(await request.arrayBuffer());
          if (bytes.byteLength === 0) return jsonBadRequest("Empty upload");
          if (bytes.byteLength > MAX_ICON_BYTES) return jsonBadRequest("Logo exceeds 512 KiB");

          const key = `org-icons/${params.org}.${ext}`;
          await serverContext().assets.put(key, bytes, type);
          unwrap(await a.svc.orgs.setIcon(a.identity, params.org, key), orgStatus);
          await a.svc.audit.record({
            action: "org_icon_set",
            packageName: params.org,
            version: null,
            actor: a.identity,
            detail: { key },
          });
          return jsonPrivate({ ok: true, org: params.org });
        }),
      DELETE: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          unwrap(await a.svc.orgs.setIcon(a.identity, params.org, null), orgStatus);
          await a.svc.audit.record({
            action: "org_icon_set",
            packageName: params.org,
            version: null,
            actor: a.identity,
            detail: { key: null },
          });
          return jsonPrivate({ ok: true, org: params.org });
        }),
    },
  },
});
