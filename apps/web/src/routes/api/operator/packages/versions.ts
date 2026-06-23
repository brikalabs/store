import { inject } from "@brika/di";
import { MetadataReader } from "@brika/registry-runtime";
import { badRequest, notFound, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runOperator } from "@/server/http";

/**
 * `GET /api/operator/packages/versions?name=@scope/pkg` - every version of a package with
 * its moderation flags (deprecated/yanked/taken-down), so the operator can act per version.
 * Operator-gated. Unlike a packument this includes taken-down versions.
 */
export const Route = createFileRoute("/api/operator/packages/versions")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async () => {
          const name = new URL(request.url).searchParams.get("name");
          if (name === null || name.length === 0) throw badRequest("A package name is required");
          const pkg = await inject(MetadataReader).getPackage(name);
          if (pkg === null) throw notFound();
          const versions = pkg.versions
            .map((v) => ({
              version: v.version,
              publishedAt: v.publishedAt,
              size: v.size,
              deprecated: v.deprecated,
              yanked: v.yanked,
              takedownReason: v.takedownReason,
            }))
            .sort((x, y) => y.publishedAt.localeCompare(x.publishedAt));
          return reply({ name, publisher: pkg.publisher, versions });
        }),
    },
  },
});
