import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { notFound, okOrThrow, readBody, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordAudit, runAuthed } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

// A member is invited by the email on their Brika account (the account id is opaque and not
// typeable); it is resolved to a `users.id` before any membership row is written.
const PutBody = z.object({
  email: z.email(),
  role: z.enum(["admin", "member"]),
});

/**
 * `GET  /api/scopes/:scope/members` - list members (any member of the scope), each enriched with
 * the account's display name + avatar for the console (membership stores only the account id).
 * `PUT  /api/scopes/:scope/members` - invite a member by email or change their role (admin only);
 * the domain refuses demoting the last admin (surfaces as 409).
 */
export const Route = createFileRoute("/api/scopes/$scope/members")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const result = okOrThrow(
            await inject(ScopeService).listMembers(a.identity, params.scope),
          );
          const social = inject(SocialService);
          const members = await Promise.all(
            result.members.map(async (m) => {
              const profile = await social.getUserProfile(m.userId);
              return {
                userId: m.userId,
                role: m.role,
                displayName: profile?.displayName ?? null,
                avatarUrl: profile?.avatarUrl ?? null,
              };
            }),
          );
          return reply({ scope: params.scope, members });
        }),
      PUT: ({ request, params }) =>
        runAuthed(request, async (a) => {
          const parsed = await readBody(request, PutBody, "Invalid email or role");
          const userId = await inject(SocialService).findUserIdByEmail(parsed.email);
          if (userId === null) {
            throw notFound(`No Brika account for ${parsed.email}; they must sign in once first`);
          }
          const result = okOrThrow(
            await inject(ScopeService).setMember(a.identity, params.scope, userId, parsed.role),
          );
          await recordAudit(a, {
            action: "scope_member_set",
            packageName: params.scope,
            detail: { userId, role: parsed.role },
          });
          return reply({ ok: true, scope: params.scope, member: result.member });
        }),
    },
  },
});
