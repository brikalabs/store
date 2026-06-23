import { inject } from "@brika/di";
import { ManagementService, tarballPath } from "@brika/registry-core";
import { MetadataReader } from "@brika/registry-runtime";
import { okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runAuthed } from "@/server/http";
import { BlobStore } from "@/server/ports/blob-store";

const Body = z.object({ name: z.string().min(1) });

/**
 * `POST /api/plugins/delete` - permanently delete an owned package: every published version,
 * its dist-tags, and its tarball bytes, so its install ids stop resolving for everyone. Scope
 * ownership is enforced server-side; this is irreversible (unlike yank). The version list is
 * read before the rows are gone so the tarball blobs can be cleaned up too.
 */
export const Route = createFileRoute("/api/plugins/delete")({
  server: {
    handlers: {
      POST: ({ request }) =>
        runAuthed(request, async (a) => {
          const { name } = await readBody(request, Body, "Invalid delete request");

          const record = await inject(MetadataReader).getPackage(name);
          const versions = record?.versions.map((v) => v.version) ?? [];

          okOrThrow(await inject(ManagementService).deletePackage(a.identity, name));
          // Record the (irreversible) deletion first - it must not be lost if blob cleanup fails.
          await recordAudit(a, { action: "delete", packageName: name });
          // The rows are already gone, so removing the now-unreferenced tarball bytes is purely
          // best-effort: a failed delete just orphans bytes, it must not fail the request.
          await Promise.allSettled(
            versions.map((version) => inject(BlobStore).delete(tarballPath(name, version))),
          );
          return reply({ ok: true, name });
        }),
    },
  },
});
