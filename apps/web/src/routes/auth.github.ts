import { createFileRoute } from "@tanstack/react-router";
import { returnCookie, safeReturnPath, stateCookie } from "@/lib/auth";
import { vars } from "@/lib/env";
import { authorizeUrl } from "@/lib/github";

/** `GET /auth/github`: start the GitHub OAuth flow. A `?return=<path>` is
 * remembered so the callback can send the user back where they started (e.g.
 * the device-authorization page with its code intact). */
export const Route = createFileRoute("/auth/github")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const state = crypto.randomUUID();
        const secure = url.protocol === "https:";
        const { GITHUB_CLIENT_ID, GITHUB_REDIRECT_URI } = vars();
        const location = authorizeUrl(GITHUB_CLIENT_ID, GITHUB_REDIRECT_URI, state);
        const headers = new Headers({ location });
        headers.append("set-cookie", stateCookie(state, secure));
        headers.append(
          "set-cookie",
          returnCookie(safeReturnPath(url.searchParams.get("return")), secure),
        );
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
