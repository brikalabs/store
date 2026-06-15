import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "../db/client";
import { getSessionUserId } from "../lib/auth";
import { jsonNotFound, jsonOk, jsonUnauthorized } from "../lib/http";
import { listComments, toggleCommentUpvote } from "../lib/social";

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
        const database = getDb(env.DB);
        if (!(await toggleCommentUpvote(database, params.commentId, userId))) return jsonNotFound();
        return jsonOk(await listComments(database, params.name, userId));
      },
    },
  },
});
