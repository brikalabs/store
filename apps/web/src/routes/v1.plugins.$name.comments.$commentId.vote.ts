import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserId } from "@/lib/auth";
import { jsonNotFound, jsonOk, jsonUnauthorized } from "@/lib/http";
import { serverContext } from "@/lib/server-context";
import { listComments, toggleCommentUpvote } from "@/lib/social";

/**
 * `POST /v1/plugins/:name/comments/:commentId/vote` - toggle the signed-in
 * user's upvote on a comment (the comment "grade"). Idempotent. Returns the
 * refreshed comment list (with the viewer's state).
 */
export const Route = createFileRoute("/v1/plugins/$name/comments/$commentId/vote")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const userId = await getSessionUserId(request);
        if (userId === null) return jsonUnauthorized();
        const database = serverContext().db;
        if (!(await toggleCommentUpvote(database, params.commentId, userId))) return jsonNotFound();
        return jsonOk(await listComments(database, params.name, userId));
      },
    },
  },
});
