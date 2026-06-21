import { inject } from "@brika/di";
import { readBody, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/auth";
import { Database } from "@/server/db/client";
import { publicJson, runHandler } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

const ProfileInput = z.object({
  displayName: z.string().max(80).optional(),
  bio: z.string().max(500).optional(),
  website: z.url().optional(),
  links: z
    .array(z.object({ label: z.string().min(1).max(40), url: z.url() }))
    .max(8)
    .optional(),
});

/**
 * `GET|PUT /api/account/profile`: the signed-in account's own user-authored
 * profile (USER-003/CONSOLE-012). Keyed by the account id (`users.id`), the
 * first-class identity (USER-001) - a user only ever reads/writes their own row.
 * Never derived from npm (USER-005). Not part of the public `/v1` contract.
 */
export const Route = createFileRoute("/api/account/profile")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runHandler(async () => {
          const _db = inject(Database).orm;
          const user = await getCurrentUser(request);
          if (user === null) throw unauthorized("Sign in required");
          const profile = await inject(SocialService).getUserProfile(user.id);
          if (profile === null) throw unauthorized("Sign in required");
          return publicJson(profile);
        }),
      PUT: ({ request }) =>
        runHandler(async () => {
          const _db = inject(Database).orm;
          const user = await getCurrentUser(request);
          if (user === null) throw unauthorized("Sign in required");
          const parsed = await readBody(request, ProfileInput, "Invalid profile");
          const social = inject(SocialService);
          await social.updateUserProfile(user.id, parsed);
          const profile = await social.getUserProfile(user.id);
          if (profile === null) throw unauthorized("Sign in required");
          return publicJson(profile);
        }),
    },
  },
});
