import { inject } from "@brika/di";
import { scopeOf } from "@brika/registry-core";
import { MetadataReader } from "@brika/registry-runtime";
import { notFound, readQuery, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runAuthed } from "@/server/http";
import { ServerT } from "@/server/i18n";
import { ScopeMembershipStore } from "@/server/stores/scope-membership-store";

const NameQuery = z.object({ name: z.string().min(1) });

/**
 * `GET /api/plugins/versions?name=<encoded>` - a package's versions with their management flags,
 * plus whether the signed-in user may manage them (scope member). `canManage` is advisory: mutations
 * are still gated by the ownership policy server-side.
 */
export const Route = createFileRoute("/api/plugins/versions")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runAuthed(request, async (a) => {
          const { name } = readQuery(
            request,
            NameQuery,
            inject(ServerT).t("api:missingPackageName"),
          );

          const record = await inject(MetadataReader).getPackage(name);
          if (record === null) throw notFound();

          const scope = scopeOf(name);
          const myScopes = await inject(ScopeMembershipStore).listScopesForMember(a.user.id);
          const canManage = scope !== null && myScopes.some((s) => s.scope === scope);

          return reply({
            name,
            latest: record.distTags.latest ?? null,
            canManage,
            versions: record.versions.map((v) => ({
              version: v.version,
              publishedAt: v.publishedAt,
              size: v.size,
              deprecated: v.deprecated,
              yanked: v.yanked,
              takedownReason: v.takedownReason,
            })),
          });
        }),
    },
  },
});
