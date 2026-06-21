import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth/auth";
import { withResolvedAvatar } from "@/server/session-avatar";

/** `GET /auth/me`: the signed-in user (or null), avatar resolved to the uploaded one. Never cached. */
export const Route = createFileRoute("/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getCurrentUser(request);
        return Response.json(
          { user: user === null ? null : await withResolvedAvatar(user) },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
