import { createFileRoute } from "@tanstack/react-router";
import { githubSignIn } from "@/lib/auth/auth";

/**
 * `GET /auth/github`: start GitHub sign-in. A compatibility shim over BetterAuth's social sign-in
 * (`require-user` redirects here as `/auth/github?return=<path>`); the flow lives in {@link githubSignIn}.
 */
export const Route = createFileRoute("/auth/github")({
  server: {
    handlers: {
      GET: ({ request }) => githubSignIn(request),
    },
  },
});
