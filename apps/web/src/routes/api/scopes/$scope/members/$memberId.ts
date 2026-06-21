import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { okOrThrow, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { recordAudit, runAuthed } from "@/server/http";

/**
 * `DELETE /api/scopes/:scope/members/:memberId` - remove a member (admin only). The domain
 * refuses removing the scope's last admin (409) and 404s a non-member.
 */
export const Route = createFileRoute("/api/scopes/$scope/members/$memberId")({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const target = { provider: "github", id: params.memberId };
          const result = okOrThrow(
            await inject(ScopeService).removeMember(a.identity, params.scope, target),
          );
          await recordAudit(a, {
            action: "scope_member_remove",
            packageName: params.scope,
            detail: target,
          });
          return reply({ ok: true, scope: params.scope, removed: result.removed });
        }),
    },
  },
});
