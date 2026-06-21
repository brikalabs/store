import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { okOrThrow, parseBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runAuthed } from "@/server/http";

const PutBody = z.object({
  memberId: z.string().min(1),
  role: z.enum(["admin", "member"]),
});

/**
 * `GET  /api/scopes/:scope/members` - list members (any member of the scope).
 * `PUT  /api/scopes/:scope/members` - add a member or change their role (admin only); the
 * domain refuses demoting the last admin (surfaces as 409).
 */
export const Route = createFileRoute("/api/scopes/$scope/members")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const result = okOrThrow(
            await inject(ScopeService).listMembers(a.identity, params.scope),
          );
          return reply({ scope: params.scope, members: result.members });
        }),
      PUT: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const parsed = parseBody(PutBody, await request.json(), "Invalid member or role");
          const target = { provider: "github", id: parsed.memberId };
          const result = okOrThrow(
            await inject(ScopeService).setMember(a.identity, params.scope, target, parsed.role),
          );
          await recordAudit(a, {
            action: "scope_member_set",
            packageName: params.scope,
            detail: { ...target, role: parsed.role },
          });
          return reply({ ok: true, scope: params.scope, member: result.member });
        }),
    },
  },
});
