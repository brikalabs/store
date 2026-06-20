import { createFileRoute } from "@tanstack/react-router";
import { jsonBadRequest, jsonNotFound, jsonPrivate } from "@/lib/http";
import { operatorAuthed } from "@/server/console-api";

/**
 * `GET /api/operator/packages/versions?name=@scope/pkg` - every version of a package with
 * its moderation flags (deprecated/yanked/taken-down), so the operator can act per version.
 * Operator-gated. Unlike a packument this includes taken-down versions.
 */
export const Route = createFileRoute("/api/operator/packages/versions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await operatorAuthed(request);
        if ("response" in a) return a.response;
        const name = new URL(request.url).searchParams.get("name");
        if (name === null || name.length === 0) return jsonBadRequest("A package name is required");
        const pkg = await a.svc.metadata.getPackage(name);
        if (pkg === null) return jsonNotFound();
        const versions = pkg.versions
          .map((v) => ({
            version: v.version,
            publishedAt: v.publishedAt,
            deprecated: v.deprecated,
            yanked: v.yanked,
            takedownReason: v.takedownReason,
          }))
          .sort((x, y) => y.publishedAt.localeCompare(x.publishedAt));
        return jsonPrivate({ name, publisher: pkg.publisher, versions });
      },
    },
  },
});
