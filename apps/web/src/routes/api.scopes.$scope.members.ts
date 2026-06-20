import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authed } from "../lib/console-api";
import { jsonBadRequest, jsonError, jsonPrivate, scopeStatus } from "../lib/http";

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
      GET: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const result = await a.svc.scopes.listMembers(a.identity, params.scope);
        if (!result.ok) return jsonError(scopeStatus(result.code), result.message);
        return jsonPrivate({ scope: params.scope, members: result.members });
      },
      PUT: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = PutBody.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid member or role");
        const target = { provider: "github", id: parsed.data.memberId };
        const result = await a.svc.scopes.setMember(
          a.identity,
          params.scope,
          target,
          parsed.data.role,
        );
        if (!result.ok) return jsonError(scopeStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "scope_member_set",
          packageName: params.scope,
          version: null,
          actor: a.identity,
          detail: { ...target, role: parsed.data.role },
        });
        return jsonPrivate({ ok: true, scope: params.scope, member: result.member });
      },
    },
  },
});
