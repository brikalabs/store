import { badRequest, notFound, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/auth";
import { ensurePluginCached, listReviews, upsertReview } from "@/lib/social/social";
import { publicJson, runHandler } from "@/server/http";
import { serverContext } from "@/server/server-context";

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
      GET: ({ request, params }) =>
        runHandler(async () => {
          const viewerId = await getSessionUserId(request);
          return publicJson(await listReviews(serverContext().db, params.name, viewerId));
        }),
      POST: ({ request, params }) =>
        runHandler(async () => {
          const userId = await getSessionUserId(request);
          if (userId === null) throw unauthorized("Sign in required");
          const body: unknown = await request.json();
          const parsed = ReviewInput.safeParse(body);
          if (!parsed.success) throw badRequest("Invalid review");
          const database = serverContext().db;
          if (!(await ensurePluginCached(database, params.name))) throw notFound();
          await upsertReview(database, params.name, userId, parsed.data);
          return publicJson(await listReviews(database, params.name, userId));
        }),
    },
  },
});
