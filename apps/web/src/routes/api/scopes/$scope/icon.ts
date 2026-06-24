import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { badRequest, okOrThrow, readBytes, reply } from "@brika/router";
import { transaction } from "@brika/tx";
import { createFileRoute } from "@tanstack/react-router";
import { sniffImageMime } from "@/lib/image-format";
import { ICON_TYPES, MAX_ICON_BYTES } from "@/lib/scope-icon";
import { recordAudit, runAuthed, runHandler } from "@/server/http";
import { BlobStore } from "@/server/ports/blob-store";
import { streamScopeIcon } from "@/server/scope-icon";

/**
 * Scope logo (ORG-009): GET streams the uploaded logo (public, 404 when none), POST uploads a raster
 * logo (<=512 KiB) to R2 (admin), DELETE clears it (admin, falls back to the generated avatar).
 */
export const Route = createFileRoute("/api/scopes/$scope/icon")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runHandler(() => streamScopeIcon(params.scope, request.headers.get("if-none-match"))),
      POST: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const type = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
          const ext = ICON_TYPES[type];
          if (ext === undefined) throw badRequest("Logo must be a PNG, JPEG, or WebP image");
          const bytes = await readBytes(request, MAX_ICON_BYTES, "Logo exceeds 512 KiB");
          // Validate the FORMAT by magic number, not the declared content-type, and require the
          // bytes to match the declared type - so a mislabelled or polyglot payload is rejected.
          if (sniffImageMime(bytes) !== type)
            throw badRequest("Logo content does not match its type");

          // Stage the blob then commit the D1 pointer in one unit: the blob self-enlists its
          // rollback, so a failed (ownership-gated) setIcon leaves no orphan in R2.
          const key = `scope-icons/${params.scope}.${ext}`;
          const assets = inject(BlobStore);
          await transaction(async () => {
            await assets.put(key, bytes, type);
            okOrThrow(await inject(ScopeService).setIcon(a.identity, params.scope, key));
          });
          await recordAudit(a, {
            action: "scope_icon_set",
            packageName: params.scope,
            detail: { key },
          });
          return reply({ ok: true, scope: params.scope });
        }),
      DELETE: ({ request, params }) =>
        runAuthed(request, async (a) => {
          okOrThrow(await inject(ScopeService).setIcon(a.identity, params.scope, null));
          await recordAudit(a, {
            action: "scope_icon_set",
            packageName: params.scope,
            detail: { key: null },
          });
          return reply({ ok: true, scope: params.scope });
        }),
    },
  },
});
