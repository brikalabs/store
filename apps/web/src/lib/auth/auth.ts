import { inject } from "@brika/di";
import { safeReturnPath } from "@/lib/auth/auth-cookies";
import { Auth } from "@/server/auth";

/**
 * The session identity the store works with everywhere downstream (console,
 * operator gating, scope ownership, social tables). `id` (the Brika account id) is
 * the only identity; `avatarUrl` resolves from BetterAuth's `image`.
 */
export interface SessionUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Resolve the BetterAuth-backed session for the request and map it to a
 * `SessionUser`, or null when signed-out / the session row is expired or revoked
 * (AUTH-012). BetterAuth reads its own bound D1 client, so no `db` is threaded in.
 */
export async function getCurrentUser(request: Request): Promise<SessionUser | null> {
  const session = await inject(Auth).api.getSession({ headers: request.headers });
  if (session === null) return null;
  const user = session.user as {
    id: string;
    name?: string | null;
    image?: string | null;
  };
  return {
    id: user.id,
    name: user.name ?? null,
    avatarUrl: user.image ?? null,
  };
}

/**
 * Just the signed-in user's account id (`users.id`), or null. Used by the public
 * `/v1` routes to attach viewer-state (own votes/reviews) without needing the full
 * profile. Backed by the same BetterAuth session as {@link getCurrentUser}.
 */
export async function getSessionUserId(request: Request): Promise<string | null> {
  const session = await inject(Auth).api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

/**
 * BetterAuth's own HTTP handler, mounting every `/api/auth/*` endpoint (callback, session, sign-out,
 * ...). The `/api/auth/$` route is just this.
 */
export const authHandler = (request: Request): Promise<Response> => inject(Auth).handler(request);

/** A 302 to `location`, forwarding the BetterAuth `set-cookie`s (session/state) from `from`. */
function redirect(location: string, from: Headers): Response {
  const out = new Headers({ location });
  for (const cookie of from.getSetCookie()) out.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers: out });
}

/**
 * Start GitHub sign-in (the `/auth/github` shim over BetterAuth's social sign-in): 302 to the
 * provider authorize URL, carrying the validated `?return=` as the post-login callback and
 * forwarding the state cookie. The provider callback lands on `/api/auth/callback/github`.
 */
export async function githubSignIn(request: Request): Promise<Response> {
  const callbackURL = safeReturnPath(new URL(request.url).searchParams.get("return"));
  const { headers, response } = await inject(Auth).api.signInSocial({
    body: { provider: "github", callbackURL },
    returnHeaders: true,
  });
  const location = headers.get("location") ?? response?.url;
  if (location === undefined || location === null) {
    return new Response("Could not initiate GitHub sign-in", { status: 502 });
  }
  return redirect(location, headers);
}

/** Sign out (delete the D1 session row + expire the cookie, AUTH-012-AC4) and 302 home. */
export async function signOut(request: Request): Promise<Response> {
  const { headers } = await inject(Auth).api.signOut({
    headers: request.headers,
    returnHeaders: true,
  });
  return redirect("/", headers);
}
