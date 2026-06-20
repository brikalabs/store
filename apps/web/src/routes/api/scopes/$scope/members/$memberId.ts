import { createFileRoute } from "@tanstack/react-router";
import { jsonPrivate } from "@/lib/http";
import { authed, runJson, unwrap } from "@/server/console-api";

/**
 * `DELETE /api/scopes/:scope/members/:memberId` - remove a member (admin only). The domain
 * refuses removing the scope's last admin (409) and 404s a non-member.
 */
export const Route = createFileRoute("/api/scopes/$scope/members/$memberId")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const target = { provider: "github", id: params.memberId };
          const result = unwrap(await a.svc.scopes.removeMember(a.identity, params.scope, target));
          await a.svc.audit.record({
            action: "scope_member_remove",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: target,
          });
          return jsonPrivate({ ok: true, scope: params.scope, removed: result.removed });
        }),
    },
  },
});
