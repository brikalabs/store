import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/auth";
import { jsonBadRequest, jsonOk, jsonUnauthorized } from "@/lib/http";
import { getUserProfile, updateUserProfile } from "@/lib/social/social";
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
 * first-class identity (USER-001) — a user only ever reads/writes their own row.
 * Never derived from npm (USER-005). Not part of the public `/v1` contract.
 */
export const Route = createFileRoute("/api/account/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = serverContext();
        const user = await getCurrentUser(request, db);
        if (user === null) return jsonUnauthorized();
        const profile = await getUserProfile(db, user.id);
        if (profile === null) return jsonUnauthorized();
        return jsonOk(profile);
      },
      PUT: async ({ request }) => {
        const { db } = serverContext();
        const user = await getCurrentUser(request, db);
        if (user === null) return jsonUnauthorized();
        const parsed = ProfileInput.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid profile");
        await updateUserProfile(db, user.id, parsed.data);
        const profile = await getUserProfile(db, user.id);
        if (profile === null) return jsonUnauthorized();
        return jsonOk(profile);
      },
    },
  },
});
