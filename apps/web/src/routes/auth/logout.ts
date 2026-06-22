import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/auth";

/**
 * `GET /auth/logout`: sign out via BetterAuth, then return home. Kept as a GET shim so existing
 * links keep working (BetterAuth's own `signOut` is a POST endpoint); the flow lives in {@link signOut}.
 */
export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      GET: ({ request }) => signOut(request),
    },
  },
});
