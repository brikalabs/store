import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookie } from "@/lib/auth";

/** `GET /auth/logout`: clear the session and return home. */
export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const secure = new URL(request.url).protocol === "https:";
        return new Response(null, {
          status: 302,
          headers: { location: "/", "set-cookie": clearSessionCookie(secure) },
        });
      },
    },
  },
});
