import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { authed, runJson, unwrap } from "@/server/console-api";

/**
 * `DELETE /api/orgs/:org/members/:memberId` - remove a member (admin only). The domain
 * refuses removing the org's last admin (409) and 404s a non-member.
 */
export const Route = createFileRoute("/api/orgs/$org/members/$memberId")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const target = { provider: "github", id: params.memberId };
          const result = unwrap(await a.svc.orgs.removeMember(a.identity, params.org, target));
          await a.svc.audit.record({
            action: "org_member_remove",
            packageName: params.org,
            version: null,
            actor: a.identity,
            detail: target,
          });
          return jsonPrivate({ ok: true, org: params.org, removed: result.removed });
        }),
    },
  },
});
