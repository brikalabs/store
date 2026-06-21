import { inject } from "@brika/di";
import { notFound, readBody } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/auth";
import { publicJson, runHandler, runUser } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

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
          return publicJson(await inject(SocialService).listReviews(params.name, viewerId));
        }),
      POST: ({ request, params }) =>
        runUser(request, async (userId) => {
          const parsed = await readBody(request, ReviewInput, "Invalid review");
          const social = inject(SocialService);
          if (!(await social.ensurePluginCached(params.name))) throw notFound();
          await social.submitReview(params.name, userId, parsed);
          return publicJson(await social.listReviews(params.name, userId));
        }),
    },
  },
});
