import { notFound, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserId } from "@/lib/auth/auth";
import { listReviews, toggleReviewHelpful } from "@/lib/social/social";
import { publicJson, runHandler } from "@/server/http";
import { serverContext } from "@/server/server-context";

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
          const database = serverContext().db;
          if (!(await toggleReviewHelpful(database, params.reviewId, userId))) throw notFound();
          return publicJson(await listReviews(database, params.name, userId));
        }),
    },
  },
});
