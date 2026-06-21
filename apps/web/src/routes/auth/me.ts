import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth/auth";
import { getDb } from "@/server/db/client";

/** `GET /auth/me`: the signed-in user (or null). Never cached. */
export const Route = createFileRoute("/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        Response.json(
          { user: await getCurrentUser(request, getDb(env.DB)) },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
