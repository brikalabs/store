import { createFileRoute } from "@tanstack/react-router";
import { githubSignIn } from "@/lib/auth/auth";

/** `GET /auth/github`: GET shim over BetterAuth social sign-in; flow lives in {@link githubSignIn}. */
export const Route = createFileRoute("/auth/github")({
  server: {
    handlers: {
      GET: ({ request }) => githubSignIn(request),
    },
  },
});
