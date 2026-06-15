import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { stateCookie } from "../lib/auth";
import { authorizeUrl } from "../lib/github";

/** `GET /auth/github`: start the GitHub OAuth flow. */
export const Route = createFileRoute("/auth/github")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const state = crypto.randomUUID();
        const secure = new URL(request.url).protocol === "https:";
        const location = authorizeUrl(env.GITHUB_CLIENT_ID, env.GITHUB_REDIRECT_URI, state);
        return new Response(null, {
          status: 302,
          headers: { location, "set-cookie": stateCookie(state, secure) },
        });
      },
    },
  },
});
