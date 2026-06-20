import { scopeOf } from "@brika/registry-core";
import { listScopesForMember } from "@brika/store-db/adapters";
import { createFileRoute } from "@tanstack/react-router";
import { jsonBadRequest, jsonNotFound, jsonPrivate } from "@/lib/http";
import { authed, runJson } from "@/server/console-api";
import { registryDb } from "@/server/registry-services";

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
        runJson(async () => {
          const a = await authed(request);
          const name = new URL(request.url).searchParams.get("name");
          if (name === null || name === "") return jsonBadRequest("Missing package name");

          const record = await a.svc.metadata.getPackage(name);
          if (record === null) return jsonNotFound();

          const scope = scopeOf(name);
          const myScopes = await listScopesForMember(registryDb(), "github", a.user.login);
          const canManage = scope !== null && myScopes.some((s) => s.scope === scope);

          return jsonPrivate({
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
