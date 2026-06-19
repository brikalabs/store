import { createFileRoute } from "@tanstack/react-router";
import { authed } from "../lib/console-api";
import { jsonError, jsonPrivate, scopeStatus } from "../lib/http";

/**
 * `DELETE /api/scopes/:scope/members/:memberId` - remove a member (admin only). The domain
 * refuses removing the scope's last admin (409) and 404s a non-member.
 */
export const Route = createFileRoute("/api/scopes/$scope/members/$memberId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const target = { provider: "github", id: params.memberId };
        const result = await a.svc.scopes.removeMember(a.identity, params.scope, target);
        if (!result.ok) return jsonError(scopeStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "scope_member_remove",
          packageName: params.scope,
          version: null,
          actor: a.identity,
          detail: target,
        });
        return jsonPrivate({ ok: true, scope: params.scope, removed: result.removed });
      },
    },
  },
});
