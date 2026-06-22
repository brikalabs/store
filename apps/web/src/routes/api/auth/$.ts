import { createFileRoute } from "@tanstack/react-router";
import { authHandler } from "@/lib/auth/auth";

/**
 * `GET|POST /api/auth/*` - the single BetterAuth handler mounting every auth endpoint (sign-in,
 * callback, session, sign-out). Adding a provider needs no new route (AUTH-010).
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => authHandler(request),
      POST: ({ request }) => authHandler(request),
    },
  },
});
