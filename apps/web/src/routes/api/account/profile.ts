import { badRequest, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/auth";
import { getUserProfile, updateUserProfile } from "@/lib/social/social";
import { publicJson, runHandler } from "@/server/http";
import { serverContext } from "@/server/server-context";

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
          const { db } = serverContext();
          const user = await getCurrentUser(request, db);
          if (user === null) throw unauthorized("Sign in required");
          const profile = await getUserProfile(db, user.id);
          if (profile === null) throw unauthorized("Sign in required");
          return publicJson(profile);
        }),
      PUT: ({ request }) =>
        runHandler(async () => {
          const { db } = serverContext();
          const user = await getCurrentUser(request, db);
          if (user === null) throw unauthorized("Sign in required");
          const parsed = ProfileInput.safeParse(await request.json());
          if (!parsed.success) throw badRequest("Invalid profile");
          await updateUserProfile(db, user.id, parsed.data);
          const profile = await getUserProfile(db, user.id);
          if (profile === null) throw unauthorized("Sign in required");
          return publicJson(profile);
        }),
    },
  },
});
