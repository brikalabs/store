import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@/server/auth";

/**
 * `GET /auth/logout`: sign out via BetterAuth (deletes the D1 session row and
 * expires the session cookie, AUTH-012-AC4), then return home. Kept as a GET shim
 * so existing links keep working; BetterAuth's own `signOut` is a POST endpoint.
 */
export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { headers } = await getAuth().api.signOut({
          headers: request.headers,
          returnHeaders: true,
        });
        const out = new Headers({ location: "/" });
        for (const cookie of headers.getSetCookie()) out.append("set-cookie", cookie);
        return new Response(null, { status: 302, headers: out });
      },
    },
  },
});
