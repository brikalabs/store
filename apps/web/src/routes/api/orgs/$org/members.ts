import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonBadRequest, jsonError, jsonPrivate, orgStatus } from "@/lib/http";
import { authed } from "@/server/console-api";

const PutBody = z.object({
  memberId: z.string().min(1),
  role: z.enum(["admin", "member"]),
});

/**
 * `GET  /api/orgs/:org/members` - list members (any member of the org).
 * `PUT  /api/orgs/:org/members` - add a member or change their role (admin only); the
 * domain refuses demoting the last admin (surfaces as 409).
 */
export const Route = createFileRoute("/api/orgs/$org/members")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const result = await a.svc.orgs.listMembers(a.identity, params.org);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        return jsonPrivate({ org: params.org, members: result.members });
      },
      PUT: async ({ request, params }) => {
        const a = await authed(request);
        if ("response" in a) return a.response;
        const parsed = PutBody.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid member or role");
        const target = { provider: "github", id: parsed.data.memberId };
        const result = await a.svc.orgs.setMember(a.identity, params.org, target, parsed.data.role);
        if (!result.ok) return jsonError(orgStatus(result.code), result.message);
        await a.svc.audit.record({
          action: "org_member_set",
          packageName: params.org,
          version: null,
          actor: a.identity,
          detail: { ...target, role: parsed.data.role },
        });
        return jsonPrivate({ ok: true, org: params.org, member: result.member });
      },
    },
  },
});
