import { inject } from "@brika/di";
import { badRequest, notFound, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/auth";
import { publicJson, runHandler } from "@/server/http";
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
        runHandler(async () => {
          const userId = await getSessionUserId(request);
          if (userId === null) throw unauthorized("Sign in required");
          const parsed = CommentInput.safeParse(await request.json());
          if (!parsed.success) throw badRequest("Invalid comment");
          const social = inject(SocialService);
          if (!(await social.ensurePluginCached(params.name))) throw notFound();
          await social.addComment(
            params.name,
            userId,
            parsed.data.body,
            parsed.data.parentId ?? null,
          );
          return publicJson(await social.listComments(params.name, userId));
        }),
    },
  },
});
