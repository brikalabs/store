import { createFileRoute } from "@tanstack/react-router";
import { authHandler } from "@/lib/auth/auth";
import { runHandler } from "@/server/http";
import { clientKey, enforceLimit } from "@/server/rate-limit";

/**
 * `GET|POST /api/auth/*` - the single BetterAuth handler mounting every auth endpoint (sign-in,
 * callback, session, sign-out). Adding a provider needs no new route (AUTH-010).
 *
 * POST (sign-in/sign-out) is IP-rate-limited via a cross-isolate Workers binding: BetterAuth's own
 * limiter is in-memory (per-isolate, ineffective on Workers), so we throttle here instead. GET
 * (get-session on every page load, the OAuth callback) is left unthrottled.
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => authHandler(request),
      POST: ({ request }) =>
        runHandler(async () => {
          await enforceLimit("AUTH_LIMITER", clientKey(request));
          return authHandler(request);
        }),
    },
  },
});
