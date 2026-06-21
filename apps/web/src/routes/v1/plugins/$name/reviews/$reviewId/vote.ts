import { notFound, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserId } from "@/lib/auth/auth";
import { publicJson, runHandler } from "@/server/http";
import { socialService } from "@/server/social";

/**
 * `POST /v1/plugins/:name/reviews/:reviewId/vote` - toggle the signed-in user's
 * "helpful" vote on a review. Idempotent; a second call removes the vote.
 * Returns the refreshed review list (with the viewer's state).
 */
export const Route = createFileRoute("/v1/plugins/$name/reviews/$reviewId/vote")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runHandler(async () => {
          const userId = await getSessionUserId(request);
          if (userId === null) throw unauthorized("Sign in required");
          const social = socialService();
          if (!(await social.toggleReviewHelpful(params.reviewId, userId))) throw notFound();
          return publicJson(await social.listReviews(params.name, userId));
        }),
    },
  },
});
