import { inject } from "@brika/di";
import { badRequest, okOrThrow, reply } from "@brika/router";
import { onRollback, transaction } from "@brika/tx";
import { createFileRoute } from "@tanstack/react-router";
import { ICON_TYPES, MAX_ICON_BYTES } from "@/lib/scope-icon";
import { BlobStore } from "@/server/blob-store";
import { authed, runHandler } from "@/server/http";
import { streamScopeIcon } from "@/server/scope-icon";

/**
 * Scope logo (ORG-009):
 *   GET    /api/scopes/:scope/icon  public - stream the uploaded logo (404 when none)
 *   POST   /api/scopes/:scope/icon  admin  - upload a raster logo (<=512 KiB) to R2
 *   DELETE /api/scopes/:scope/icon  admin  - clear the logo (falls back to the generated avatar)
 */
export const Route = createFileRoute("/api/scopes/$scope/icon")({
  server: {
    handlers: {
      GET: ({ params }) => runHandler(() => streamScopeIcon(params.scope)),
      POST: ({ request, params }) =>
        runHandler(async () => {
          const a = await authed(request);
          const type = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
          const ext = ICON_TYPES[type];
          if (ext === undefined) throw badRequest("Logo must be a PNG, JPEG, or WebP image");
          const bytes = new Uint8Array(await request.arrayBuffer());
          if (bytes.byteLength === 0) throw badRequest("Empty upload");
          if (bytes.byteLength > MAX_ICON_BYTES) throw badRequest("Logo exceeds 512 KiB");

          // Stage the blob then commit the D1 pointer atomically: if the ownership-gated
          // setIcon fails (e.g. not a scope member), the transaction rolls back and the
          // onRollback compensation deletes the just-staged blob, so a rejected upload never
          // leaves an orphaned object in R2.
          const key = `scope-icons/${params.scope}.${ext}`;
          const assets = inject(BlobStore);
          await transaction(async () => {
            await assets.put(key, bytes, type);
            onRollback(() => assets.delete(key));
            okOrThrow(await a.svc.scopes.setIcon(a.identity, params.scope, key));
          });
          await a.svc.audit.record({
            action: "scope_icon_set",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { key },
          });
          return reply({ ok: true, scope: params.scope });
        }),
      DELETE: ({ request, params }) =>
        runHandler(async () => {
          const a = await authed(request);
          okOrThrow(await a.svc.scopes.setIcon(a.identity, params.scope, null));
          await a.svc.audit.record({
            action: "scope_icon_set",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { key: null },
          });
          return reply({ ok: true, scope: params.scope });
        }),
    },
  },
});
