import { createFileRoute } from "@tanstack/react-router";
import { safeReturnPath } from "@/lib/auth/auth";
import { getAuth } from "@/server/auth";

/**
 * `GET /auth/github`: start GitHub sign-in. A compatibility shim over BetterAuth's
 * social sign-in (`require-user` redirects here as `/auth/github?return=<path>`).
 * We ask BetterAuth for the provider authorize URL (carrying the validated return
 * as the post-login `callbackURL`) and forward its `location` + state cookie. The
 * provider callback is handled by `/api/auth/callback/github` (the `$.ts` route).
 */
export const Route = createFileRoute("/auth/github")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const callbackURL = safeReturnPath(url.searchParams.get("return"));
        const { headers, response } = await getAuth().api.signInSocial({
          body: { provider: "github", callbackURL },
          returnHeaders: true,
        });
        const location = headers.get("location") ?? response?.url;
        if (location === undefined || location === null) {
          return new Response("Could not initiate GitHub sign-in", { status: 502 });
        }
        const out = new Headers({ location });
        for (const cookie of headers.getSetCookie()) out.append("set-cookie", cookie);
        return new Response(null, { status: 302, headers: out });
      },
    },
  },
});
