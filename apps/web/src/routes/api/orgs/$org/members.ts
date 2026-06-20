import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonPrivate } from "@/lib/http";
import { authed, parseBody, runJson, unwrap } from "@/server/console-api";

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
      GET: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const result = unwrap(await a.svc.orgs.listMembers(a.identity, params.org));
          return jsonPrivate({ org: params.org, members: result.members });
        }),
      PUT: ({ request, params }) =>
        runJson(async () => {
          const a = await authed(request);
          const parsed = parseBody(PutBody, await request.json(), "Invalid member or role");
          const target = { provider: "github", id: parsed.memberId };
          const result = unwrap(
            await a.svc.orgs.setMember(a.identity, params.org, target, parsed.role),
          );
          await a.svc.audit.record({
            action: "org_member_set",
            packageName: params.org,
            version: null,
            actor: a.identity,
            detail: { ...target, role: parsed.role },
          });
          return jsonPrivate({ ok: true, org: params.org, member: result.member });
        }),
    },
  },
});
