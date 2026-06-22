import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getCurrentUser, type SessionUser } from "@/lib/auth/auth";
import { withResolvedAvatar } from "@/server/session-avatar";

/**
 * Resolve the session user from the request cookie. A server function so the raw request + D1 lookup
 * always run on the server. The avatar is resolved to the account's uploaded image.
 */
export const fetchSessionUser = createServerFn().handler(async (): Promise<SessionUser | null> => {
  const user = await getCurrentUser(getRequest());
  return user === null ? null : withResolvedAvatar(user);
});

/**
 * `beforeLoad` guard for console routes: returns the signed-in user, or throws a redirect to `/login`
 * carrying `?return=` so the user lands back here after sign-in.
 */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await fetchSessionUser();
  if (user === null) {
    throw redirect({ to: "/login", search: { return: returnTo } });
  }
  return user;
}
