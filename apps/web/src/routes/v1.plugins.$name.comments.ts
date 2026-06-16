import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSessionUserId } from "../lib/auth";
import { jsonBadRequest, jsonNotFound, jsonOk, jsonUnauthorized } from "../lib/http";
import { serverContext } from "../lib/server-context";
import { addComment, ensurePluginCached, listComments } from "../lib/social";

const CommentInput = z.object({
  body: z.string().min(1).max(5000),
  parentId: z.string().nullish(),
});

/** `GET|POST /v1/plugins/:name/comments` (POST requires a session). */
export const Route = createFileRoute("/v1/plugins/$name/comments")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const viewerId = await getSessionUserId(request);
        return jsonOk(await listComments(serverContext().db, params.name, viewerId));
      },
      POST: async ({ request, params }) => {
        const userId = await getSessionUserId(request);
        if (userId === null) return jsonUnauthorized();
        const body: unknown = await request.json();
        const parsed = CommentInput.safeParse(body);
        if (!parsed.success) return jsonBadRequest("Invalid comment");
        const database = serverContext().db;
        if (!(await ensurePluginCached(database, params.name))) return jsonNotFound();
        await addComment(
          database,
          params.name,
          userId,
          parsed.data.body,
          parsed.data.parentId ?? null,
        );
        return jsonOk(await listComments(database, params.name, userId));
      },
    },
  },
});
