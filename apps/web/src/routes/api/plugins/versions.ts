import { inject } from "@brika/di";
import { scopeOf } from "@brika/registry-core";
import { badRequest, notFound, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { runAuthed } from "@/server/http";
import { Metadata } from "@/server/registry-services";
import { ScopeMembershipStore } from "@/server/stores/scope-membership-store";

/**
 * `GET /api/plugins/versions?name=<encoded>` - a registry-hosted package's versions with
 * their management flags, plus whether the signed-in user may manage them (is a member of
 * the package's scope). Drives the plugin management page; mutations are still gated by the
 * domain ownership policy server-side.
 */
export const Route = createFileRoute("/api/plugins/versions")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runAuthed(request, async (a) => {
          const name = new URL(request.url).searchParams.get("name");
          if (name === null || name === "") throw badRequest("Missing package name");

          const record = await inject(Metadata).getPackage(name);
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
              deprecated: v.deprecated,
              yanked: v.yanked,
              takedownReason: v.takedownReason,
            })),
          });
        }),
    },
  },
});
