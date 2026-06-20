import { createFileRoute } from "@tanstack/react-router";
import { clearReturnCookie, readOauthState, readReturnPath, sessionCookie } from "@/lib/auth/auth";
import { exchangeCode, fetchUser } from "@/lib/auth/github";
import { markDeveloperVerified, upsertUser } from "@/lib/social/social";
import { vars } from "@/server/env";
import { serverContext } from "@/server/server-context";

/** `GET /auth/github/callback`: finish OAuth, upsert the user, set the session. */
export const Route = createFileRoute("/auth/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (code === null || state === null || state !== readOauthState(request)) {
          return new Response("Invalid OAuth state", { status: 400 });
        }

        const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = vars();
        const token = await exchangeCode(code, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET);
        if (token === null) return new Response("OAuth exchange failed", { status: 502 });
        const ghUser = await fetchUser(token);
        if (ghUser === null) return new Response("Could not load GitHub user", { status: 502 });

        const database = serverContext().db;
        const userId = `gh_${ghUser.id}`;
        await upsertUser(database, {
          id: userId,
          githubId: ghUser.id,
          login: ghUser.login,
          name: ghUser.name,
          avatarUrl: ghUser.avatarUrl,
        });
        await markDeveloperVerified(database, ghUser.login);

        const secure = url.protocol === "https:";
        const headers = new Headers({ location: readReturnPath(request) });
        headers.append("set-cookie", await sessionCookie(userId, secure));
        headers.append("set-cookie", clearReturnCookie(secure));
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
