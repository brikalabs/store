import { inject } from "@brika/di";
import { notFound } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { publicJson, runUser } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

/**
 * `POST /v1/plugins/:name/reviews/:reviewId/vote` - toggle the signed-in user's
 * "helpful" vote on a review. Idempotent; a second call removes the vote.
 * Returns the refreshed review list (with the viewer's state).
 */
export const Route = createFileRoute("/v1/plugins/$name/reviews/$reviewId/vote")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runUser(request, async (userId) => {
          const social = inject(SocialService);
          if (!(await social.toggleReviewHelpful(params.reviewId, userId))) throw notFound();
          return publicJson(await social.listReviews(params.name, userId));
        }),
    },
  },
});
