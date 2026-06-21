import { getAuth } from "@/server/auth";
import type { Db } from "@/server/db/client";

// Pure cookie/redirect helpers live in `./auth-cookies` (unit-tested there);
// re-exported so callers keep importing them from `./auth`.
export { parseCookies, safeReturnPath } from "@/lib/auth/auth-cookies";

/**
 * The session identity the store works with everywhere downstream (console,
 * operator gating, scope ownership, social tables). `login` is the GitHub
 * username; `avatarUrl` resolves from BetterAuth's `image`. This shape is the
 * stable contract - it is unchanged by the move to BetterAuth.
 */
export interface SessionUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Resolve the BetterAuth-backed session for the request and map it to a
 * `SessionUser`, or null when signed-out / the session row is expired or revoked
 * (AUTH-012). The `db` parameter is kept for the call-site contract; BetterAuth
 * reads its own bound D1 client, so it is intentionally unused here.
 */
export async function getCurrentUser(request: Request, _db: Db): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (session === null) return null;
  const user = session.user as {
    id: string;
    name?: string | null;
    image?: string | null;
    login?: string | null;
  };
  return {
    id: user.id,
    login: user.login ?? "",
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
  const session = await getAuth().api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}
