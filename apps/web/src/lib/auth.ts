import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { users } from "../db/schema";
import { parseCookies, safeReturnPath } from "./auth-cookies";
import { vars } from "./env";
import { signSession, verifySession } from "./session";

// Pure cookie/redirect helpers live in `./auth-cookies` (unit-tested there);
// re-exported so callers keep importing them from `./auth`.
export { parseCookies, safeReturnPath } from "./auth-cookies";

const SESSION_COOKIE = "brika_session";
const STATE_COOKIE = "brika_oauth_state";
const RETURN_COOKIE = "brika_oauth_return";

export interface SessionUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export async function getSessionUserId(request: Request): Promise<string | null> {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (token === undefined) return null;
  return verifySession(token, vars().SESSION_SECRET);
}

export async function getCurrentUser(request: Request, db: Db): Promise<SessionUser | null> {
  const userId = await getSessionUserId(request);
  if (userId === null) return null;
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  if (row === undefined) return null;
  return { id: row.id, login: row.login, name: row.name, avatarUrl: row.avatarUrl };
}

function attrs(secure: boolean): string {
  return `HttpOnly; SameSite=Lax; Path=/${secure ? "; Secure" : ""}`;
}

export async function sessionCookie(userId: string, secure: boolean): Promise<string> {
  const token = await signSession(userId, vars().SESSION_SECRET);
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${attrs(secure)}; Max-Age=2592000`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; ${attrs(secure)}; Max-Age=0`;
}

export function stateCookie(state: string, secure: boolean): string {
  return `${STATE_COOKIE}=${state}; ${attrs(secure)}; Max-Age=600`;
}

export function readOauthState(request: Request): string | undefined {
  return parseCookies(request.headers.get("cookie"))[STATE_COOKIE];
}

/** Remember where to send the user after OAuth (e.g. back to `/device?code=…`). */
export function returnCookie(path: string, secure: boolean): string {
  return `${RETURN_COOKIE}=${encodeURIComponent(path)}; ${attrs(secure)}; Max-Age=600`;
}

/** The validated path saved by {@link returnCookie}, defaulting to `/`. */
export function readReturnPath(request: Request): string {
  return safeReturnPath(parseCookies(request.headers.get("cookie"))[RETURN_COOKIE]);
}

export function clearReturnCookie(secure: boolean): string {
  return `${RETURN_COOKIE}=; ${attrs(secure)}; Max-Age=0`;
}
