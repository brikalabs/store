import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth/auth";

/** `GET /auth/me`: the signed-in user (or null). Never cached. */
export const Route = createFileRoute("/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        Response.json(
          { user: await getCurrentUser(request) },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
