import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserId } from "@/lib/auth";
import { jsonNotFound, jsonOk, jsonUnauthorized } from "@/lib/http";
import { serverContext } from "@/lib/server-context";
import { listReviews, toggleReviewHelpful } from "@/lib/social";

/**
 * `POST /v1/plugins/:name/reviews/:reviewId/vote` - toggle the signed-in user's
 * "helpful" vote on a review. Idempotent; a second call removes the vote.
 * Returns the refreshed review list (with the viewer's state).
 */
export const Route = createFileRoute("/v1/plugins/$name/reviews/$reviewId/vote")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const userId = await getSessionUserId(request);
        if (userId === null) return jsonUnauthorized();
        const database = serverContext().db;
        if (!(await toggleReviewHelpful(database, params.reviewId, userId))) return jsonNotFound();
        return jsonOk(await listReviews(database, params.name, userId));
      },
    },
  },
});
