import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

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
        runJson(async () => {
          const a = await authed(request);
          const result = unwrap(await a.svc.scopes.listMembers(a.identity, params.scope));
          return jsonPrivate({ scope: params.scope, members: result.members });
        }),
      PUT: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const parsed = parseBody(PutBody, await request.json(), "Invalid member or role");
          const target = { provider: "github", id: parsed.memberId };
          const result = unwrap(
            await a.svc.scopes.setMember(a.identity, params.scope, target, parsed.role),
          );
          await a.svc.audit.record({
            action: "scope_member_set",
            packageName: params.scope,
            version: null,
            actor: a.identity,
            detail: { ...target, role: parsed.role },
          });
          return jsonPrivate({ ok: true, scope: params.scope, member: result.member });
        }),
    },
  },
});
