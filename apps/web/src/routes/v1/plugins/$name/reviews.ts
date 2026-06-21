import { inject } from "@brika/di";
import { badRequest, notFound, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/auth";
import { publicJson, runHandler } from "@/server/http";
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
        runHandler(async () => {
          const userId = await getSessionUserId(request);
          if (userId === null) throw unauthorized("Sign in required");
          const parsed = ReviewInput.safeParse(await request.json());
          if (!parsed.success) throw badRequest("Invalid review");
          const social = inject(SocialService);
          if (!(await social.ensurePluginCached(params.name))) throw notFound();
          await social.submitReview(params.name, userId, parsed.data);
          return publicJson(await social.listReviews(params.name, userId));
        }),
    },
  },
});
