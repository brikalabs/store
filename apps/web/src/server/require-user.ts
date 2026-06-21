import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getCurrentUser, type SessionUser } from "@/lib/auth/auth";
import { withResolvedAvatar } from "@/server/session-avatar";

/**
 * Resolve the session user from the request cookie. A server function so the server-only
 * bits (the raw request + the D1 binding) always run on the server, even when a route's
 * `beforeLoad` executes on the client during a client-side navigation - the Start plugin
 * splits this handler out of the client bundle and calls it over RPC. The avatar is resolved
 * to the account's uploaded image so the dashboard sidebar matches the rest of the app.
 */
export const fetchSessionUser = createServerFn().handler(async (): Promise<SessionUser | null> => {
  const user = await getCurrentUser(getRequest());
  return user === null ? null : withResolvedAvatar(user);
});

/**
 * `beforeLoad` guard for console routes: returns the signed-in user, or throws a redirect to the
 * provider-agnostic `/login` page carrying `?return=` so the user lands back here after sign-in.
 * The page lists the configured providers (BetterAuth `socialProviders`); the guard never picks one,
 * so adding a provider needs no change here. `redirect` is isomorphic; only `fetchSessionUser`
 * touches server-only modules.
 */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await fetchSessionUser();
  if (user === null) {
    throw redirect({ to: "/login", search: { return: returnTo } });
  }
  return user;
}
