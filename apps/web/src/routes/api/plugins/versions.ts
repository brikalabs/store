import { inject } from "@brika/di";
import { scopeOf } from "@brika/registry-core";
import { MetadataReader } from "@brika/registry-runtime";
import { badRequest, notFound, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runAuthed } from "@/server/http";
import { ServerT } from "@/server/i18n";
import { ScopeMembershipStore } from "@/server/stores/scope-membership-store";

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
          const name = new URL(request.url).searchParams.get("name");
          if (name === null || name === "")
            throw badRequest(inject(ServerT).t("api:missingPackageName"));

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
