import { createFileRoute } from "@tanstack/react-router";
import { jsonError, jsonPrivate, orgStatus } from "@/lib/http";
import { authed } from "@/server/console-api";

/**
 * `DELETE /api/orgs/:org/members/:memberId` - remove a member (admin only). The domain
 * refuses removing the org's last admin (409) and 404s a non-member.
 */
export const Route = createFileRoute("/api/orgs/$org/members/$memberId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const target = { provider: "github", id: params.memberId };
        const result = await a.svc.orgs.removeMember(a.identity, params.org, target);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_member_remove",
          packageName: params.org,
          version: null,
          actor: a.identity,
          detail: target,
        });
        return jsonPrivate({ ok: true, org: params.org, removed: result.removed });
      },
    },
  },
});
