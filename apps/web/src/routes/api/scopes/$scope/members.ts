import { inject } from "@brika/di";
import { ScopeService } from "@brika/registry-core";
import { notFound, okOrThrow, reply } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readJsonBody, recordAudit, runAuthed } from "@/server/http";
import { ServerT } from "@/server/i18n";
import { SocialService } from "@/server/services/social-service";

// Invited by account email (the account id is opaque), resolved to a `users.id` before the write.
const PutBody = z.object({
  email: z.email(),
  role: z.enum(["admin", "member"]),
});

/**
 * `GET` lists members (any member), each enriched with the account's display name + avatar.
 * `PUT` invites a member by email or changes their role (admin only); the domain refuses demoting
 * the last admin (409).
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
          const parsed = await readJsonBody(request, PutBody, "api:invalidEmailOrRole");
          const userId = await inject(SocialService).findUserIdByEmail(parsed.email);
          if (userId === null) {
            throw notFound(inject(ServerT).t("api:noAccountForEmail", { email: parsed.email }));
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
