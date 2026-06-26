import { inject } from "@brika/di";
import { MetadataReader } from "@brika/registry-runtime";
import { notFound, readQuery, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runOperator } from "@/server/http";
import { ServerT } from "@/server/i18n";

const NameQuery = z.object({ name: z.string().min(1) });

/**
 * `GET /api/operator/plugins/versions?name=@scope/pkg` - every version of a package with
 * its moderation flags (deprecated/yanked/taken-down), so the operator can act per version.
 * Operator-gated. Unlike a packument this includes taken-down versions.
 */
export const Route = createFileRoute("/api/operator/plugins/versions")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runOperator(request, async () => {
          const { name } = readQuery(
            request,
            NameQuery,
            inject(ServerT).t("api:packageNameRequired"),
          );
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
