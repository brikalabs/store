import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getDb } from "../db/client";
import { getCurrentUser } from "../lib/auth";
import { jsonBadRequest, jsonOk, jsonUnauthorized } from "../lib/http";
import { getDeveloperProfile, updateDeveloperProfile } from "../lib/social";

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
        const user = await getCurrentUser(request);
        if (user === null) return jsonUnauthorized();
        return jsonOk(await getDeveloperProfile(getDb(env.DB), user.login));
      },
      PUT: async ({ request }) => {
        const user = await getCurrentUser(request);
        if (user === null) return jsonUnauthorized();
        const parsed = ProfileInput.safeParse(await request.json());
        if (!parsed.success) return jsonBadRequest("Invalid profile");
        const db = getDb(env.DB);
        await updateDeveloperProfile(db, user.login, parsed.data);
        return jsonOk(await getDeveloperProfile(db, user.login));
      },
    },
  },
});
