import { notFound, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserId } from "@/lib/auth/auth";
import { listComments, toggleCommentUpvote } from "@/lib/social/social";
import { publicJson, runHandler } from "@/server/http";
import { serverContext } from "@/server/server-context";

/**
 * `POST /v1/plugins/:name/comments/:commentId/vote` - toggle the signed-in
 * user's upvote on a comment (the comment "grade"). Idempotent. Returns the
 * refreshed comment list (with the viewer's state).
 */
export const Route = createFileRoute("/v1/plugins/$name/comments/$commentId/vote")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runHandler(async () => {
          const userId = await getSessionUserId(request);
          if (userId === null) throw unauthorized("Sign in required");
          const database = serverContext().db;
          if (!(await toggleCommentUpvote(database, params.commentId, userId))) throw notFound();
          return publicJson(await listComments(database, params.name, userId));
        }),
    },
  },
});
