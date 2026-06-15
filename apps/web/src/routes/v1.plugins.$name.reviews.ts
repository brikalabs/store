import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getDb } from "../db/client";
import { getSessionUserId } from "../lib/auth";
import { jsonBadRequest, jsonNotFound, jsonOk, jsonUnauthorized } from "../lib/http";
import { ensurePluginCached, listReviews, upsertReview } from "../lib/social";

const ReviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().min(1).max(5000),
  versionReviewed: z.string().optional(),
});

/** `GET|POST /v1/plugins/:name/reviews` (POST requires a session). */
export const Route = createFileRoute("/v1/plugins/$name/reviews")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const viewerId = await getSessionUserId(request);
        return jsonOk(await listReviews(getDb(env.DB), params.name, viewerId));
      },
      POST: async ({ request, params }) => {
        const userId = await getSessionUserId(request);
        if (userId === null) return jsonUnauthorized();
        const body: unknown = await request.json();
        const parsed = ReviewInput.safeParse(body);
        if (!parsed.success) return jsonBadRequest("Invalid review");
        const database = getDb(env.DB);
        if (!(await ensurePluginCached(database, params.name))) return jsonNotFound();
        await upsertReview(database, params.name, userId, parsed.data);
        return jsonOk(await listReviews(database, params.name, userId));
      },
    },
  },
});
