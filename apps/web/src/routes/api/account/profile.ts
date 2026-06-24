import { inject } from "@brika/di";
import { notFound, readBody } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { publicJson, runUser } from "@/server/http";
import { ServerT } from "@/server/i18n";
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
 * `GET|PUT /api/account/profile`: the signed-in account's own user-authored profile
 * (USER-003/CONSOLE-012). Keyed by the session `users.id`, so a user only reads/writes their own row.
 */
export const Route = createFileRoute("/api/account/profile")({
  server: {
    handlers: {
      GET: ({ request }) =>
        runUser(request, async (userId) => {
          const profile = await inject(SocialService).getUserProfile(userId);
          if (profile === null) throw notFound();
          return publicJson(profile);
        }),
      PUT: ({ request }) =>
        runUser(request, async (userId) => {
          const parsed = await readBody(
            request,
            ProfileInput,
            inject(ServerT).t("api:invalidAccountProfile"),
          );
          const social = inject(SocialService);
          await social.updateUserProfile(userId, parsed);
          const profile = await social.getUserProfile(userId);
          if (profile === null) throw notFound();
          return publicJson(profile);
        }),
    },
  },
});
