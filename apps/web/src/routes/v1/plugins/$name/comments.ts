import { inject } from "@brika/di";
import { badRequest, notFound, readBody } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/auth";
import { publicJson, runHandler, runUser } from "@/server/http";
import { SocialService } from "@/server/services/social-service";

const CommentInput = z.object({
  body: z.string().min(1).max(5000),
  parentId: z.string().nullish(),
});

/** `GET|POST /v1/plugins/:name/comments` (POST requires a session). */
export const Route = createFileRoute("/v1/plugins/$name/comments")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        runHandler(async () => {
          const viewerId = await getSessionUserId(request);
          return publicJson(await inject(SocialService).listComments(params.name, viewerId));
        }),
      POST: ({ request, params }) =>
        runUser(request, async (userId) => {
          const parsed = await readBody(request, CommentInput, "Invalid comment");
          const social = inject(SocialService);
          if (!(await social.ensurePluginCached(params.name))) throw notFound();
          const posted = await social.addComment(
            params.name,
            userId,
            parsed.body,
            parsed.parentId ?? null,
          );
          if (!posted) throw badRequest("Reply to an unknown comment");
          return publicJson(await social.listComments(params.name, userId));
        }),
    },
  },
});
