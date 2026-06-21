import { badRequest, notFound, unauthorized } from "@brika/router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/auth";
import { addComment, ensurePluginCached, listComments } from "@/lib/social/social";
import { publicJson, runHandler } from "@/server/http";
import { serverContext } from "@/server/server-context";

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
          return publicJson(await listComments(serverContext().db, params.name, viewerId));
        }),
      POST: ({ request, params }) =>
        runHandler(async () => {
          const userId = await getSessionUserId(request);
          if (userId === null) throw unauthorized("Sign in required");
          const body: unknown = await request.json();
          const parsed = CommentInput.safeParse(body);
          if (!parsed.success) throw badRequest("Invalid comment");
          const database = serverContext().db;
          if (!(await ensurePluginCached(database, params.name))) throw notFound();
          await addComment(
            database,
            params.name,
            userId,
            parsed.data.body,
            parsed.data.parentId ?? null,
          );
          return publicJson(await listComments(database, params.name, userId));
        }),
    },
  },
});
