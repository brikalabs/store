import { inject } from "@brika/di";
import { safeReturnPath } from "@/lib/auth/auth-cookies";
import { Auth } from "@/server/auth";

/** The session identity used everywhere downstream; `id` (the Brika account id) is the only identity. */
export interface SessionUser {
  id: string;
  name: string | null;
  /** Shown to the user themselves (their own account menu); never identity. */
  email: string | null;
  avatarUrl: string | null;
}

/** Resolve the BetterAuth session to a `SessionUser`, or null when signed-out/expired/revoked (AUTH-012). */
export async function getCurrentUser(request: Request): Promise<SessionUser | null> {
  const session = await inject(Auth).api.getSession({ headers: request.headers });
  if (session === null) return null;
  const user = session.user as {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    avatarUrl: user.image ?? null,
  };
}

/** The signed-in account id, or null. Used by `/v1` routes to attach viewer-state without the full profile. */
export async function getSessionUserId(request: Request): Promise<string | null> {
  const session = await inject(Auth).api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

/** BetterAuth's HTTP handler, mounting every `/api/auth/*` endpoint. */
export const authHandler = (request: Request): Promise<Response> => inject(Auth).handler(request);

/** A 302 to `location`, forwarding the BetterAuth `set-cookie`s (session/state) from `from`. */
function redirect(location: string, from: Headers): Response {
  const out = new Headers({ location });
  for (const cookie of from.getSetCookie()) out.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers: out });
}

/** Start GitHub sign-in: 302 to the provider authorize URL, carrying the validated `?return=`
 * as the post-login callback and forwarding the state cookie. */
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
