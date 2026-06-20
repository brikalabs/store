import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { jsonBadRequest, jsonOk, jsonUnauthorized } from "@/lib/http";
import { serverContext } from "@/lib/server-context";
import { getDeveloperProfile, updateDeveloperProfile } from "@/lib/social";

const ProfileInput = z.object({
  displayName: z.string().max(80).optional(),
  bio: z.string().max(500).optional(),
  website: z.url().optional(),
});

/**
 * `GET|PUT /api/account/profile`: the signed-in developer's own profile. Keyed
 * by the GitHub login (which the verified-author model treats as the npm
 * maintainer id). Not part of the public `/v1` contract.
 */
export const Route = createFileRoute("/api/account/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = serverContext();
        const user = await getCurrentUser(request, db);
        if (user === null) return jsonUnauthorized();
        return jsonOk(await getDeveloperProfile(db, user.login));
      },
      PUT: async ({ request }) => {
        const { db } = serverContext();
        const user = await getCurrentUser(request, db);
        if (user === null) return jsonUnauthorized();
        const parsed = ProfileInput.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid profile");
        await updateDeveloperProfile(db, user.login, parsed.data);
        return jsonOk(await getDeveloperProfile(db, user.login));
      },
    },
  },
});
