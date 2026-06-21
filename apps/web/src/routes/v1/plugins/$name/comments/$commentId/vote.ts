import { inject } from "@brika/di";
import { notFound } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { publicJson, runUser } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

/**
 * `POST /v1/plugins/:name/comments/:commentId/vote` - toggle the signed-in
 * user's upvote on a comment (the comment "grade"). Idempotent. Returns the
 * refreshed comment list (with the viewer's state).
 */
export const Route = createFileRoute("/v1/plugins/$name/comments/$commentId/vote")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        runUser(request, async (userId) => {
          const social = inject(SocialService);
          if (!(await social.toggleCommentUpvote(params.commentId, userId))) throw notFound();
          return publicJson(await social.listComments(params.name, userId));
        }),
    },
  },
});
