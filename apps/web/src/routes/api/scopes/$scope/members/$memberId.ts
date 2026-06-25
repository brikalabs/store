import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { okOrThrow, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readJsonBody, recordAudit, runAuthed } from "@/server/http";

const RoleBody = z.object({ role: z.enum(["admin", "member"]) });

/**
 * `PUT` changes a member's role, `DELETE` removes a member (both by account id, admin only). The
 * domain refuses demoting/removing the scope's last admin (409) and 404s a non-member.
 */
export const Route = createFileRoute("/api/scopes/$scope/members/$memberId")({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const { role } = await readJsonBody(request, RoleBody, "api:invalidRole");
          const result = okOrThrow(
            await inject(ScopeService).setMember(a.identity, params.scope, params.memberId, role),
          );
          await recordAudit(a, {
            action: "scope_member_set",
            packageName: params.scope,
            detail: { userId: params.memberId, role },
          });
          return reply({ ok: true, scope: params.scope, member: result.member });
        }),
      DELETE: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const result = okOrThrow(
            await inject(ScopeService).removeMember(a.identity, params.scope, params.memberId),
          );
          await recordAudit(a, {
            action: "scope_member_remove",
            packageName: params.scope,
            detail: { userId: params.memberId },
          });
          return reply({ ok: true, scope: params.scope, removed: result.removed });
        }),
    },
  },
});
