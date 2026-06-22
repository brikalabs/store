import { createFileRoute } from "@tanstack/react-router";
import { authHandler } from "@/lib/auth/auth";

/**
 * `GET|POST /api/auth/*` - the single BetterAuth handler mounting every auth
 * endpoint (social sign-in initiate + provider callback, who-am-i, sign-out,
 * session). Adding a provider needs no new route (AUTH-010). The hand-rolled
 * `/auth/github` + `/auth/github/callback` flow is retired in favor of this.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => authHandler(request),
      POST: ({ request }) => authHandler(request),
    },
  },
});
