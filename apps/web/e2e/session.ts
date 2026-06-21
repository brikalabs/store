import { Database } from "bun:sqlite";
import { randomBytes } from "node:crypto";

/**
 * Forge a BetterAuth session for e2e + unit fixtures (AUTH-012). BetterAuth uses
 * DB-backed sessions: a `session` row holds the opaque `token`, and the browser
 * carries a signed cookie `better-auth.session_token=<token>.<sig>` that
 * `getSession` verifies and looks the row up by. So minting a usable session is
 * two parts: (1) insert the row, (2) hand back the signed cookie.
 *
 * The signing scheme is read straight from the installed BetterAuth /
 * better-call source so the forged cookie is byte-identical to a real one:
 *   - cookie NAME: `better-auth.session_token` (the `<cookiePrefix>.session_token`
 *     default from better-auth `getCookies`; no `__Secure-` prefix because the
 *     dev/e2e `BETTER_AUTH_URL` is http, not https).
 *   - cookie VALUE: `<token>.<signature>` where
 *     `signature = base64(HMAC-SHA256(token, SESSION_SECRET))` - standard base64
 *     (44 chars, trailing `=`), exactly what better-call's `makeSignature`
 *     produces and its `getSignedCookie` verifies (it splits on the last `.`,
 *     requires a 44-char signature ending in `=`, and HMAC-verifies the rest).
 *
 * The secret is pinned in .dev.vars / playwright.config.ts (and passed explicitly
 * by the round-trip unit test), so a spec can authenticate as a seeded user
 * without driving the real GitHub OAuth flow.
 */

/** BetterAuth's session cookie name for our config (default prefix, http origin). */
export const SESSION_COOKIE_NAME = "better-auth.session_token";

/** The dev/e2e signing secret (matches .dev.vars `SESSION_SECRET`). */
const DEV_SESSION_SECRET = "dev-only-secret-not-for-production";

/**
 * Sign a value the way better-call does: `<value>.<base64(HMAC-SHA256(value, secret))>`.
 * Standard base64 (not base64url) - better-call asserts the signature is 44 chars
 * and ends with `=`, so it must be plain base64 of the 32-byte digest.
 */
async function signSessionToken(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return `${token}.${signature}`;
}

/** A minimal sink for the `session` row insert: a sqlite handle or a callback. */
type SessionSink =
  | string // a local D1 sqlite file path
  | Database // an open bun:sqlite handle (e.g. the in-memory test db)
  | { insertSession: (row: SessionRow) => void };

/** The columns we write into the BetterAuth `session` table. */
interface SessionRow {
  id: string;
  token: string;
  userId: string;
  /** Unix seconds. */
  expiresAt: number;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds. */
  updatedAt: number;
  ipAddress: string;
  userAgent: string;
}

function insertSessionRow(db: Database, row: SessionRow): void {
  db.run(
    "INSERT INTO session (id, token, user_id, expires_at, created_at, updated_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      row.id,
      row.token,
      row.userId,
      row.expiresAt,
      row.createdAt,
      row.updatedAt,
      row.ipAddress,
      row.userAgent,
    ],
  );
}

export interface MintSessionOptions {
  /** The `users.id` this session authenticates as. */
  userId: string;
  /** Signing secret; defaults to the pinned dev secret. */
  secret?: string;
  /** Session lifetime in seconds (default ~1h). */
  expiresInSeconds?: number;
}

export interface MintedSession {
  /** The opaque session token (also the `session.token` row value). */
  token: string;
  /** The signed cookie name (`better-auth.session_token`). */
  name: string;
  /** The signed cookie value (`<token>.<signature>`). */
  value: string;
}

/**
 * Insert a BetterAuth `session` row into `sink` and return the signed cookie that
 * authenticates as `userId`. `sink` is a local D1 file path (e2e seed), an open
 * bun:sqlite handle (the in-memory round-trip test), or a custom insert callback.
 */
export async function mintBetterAuthSession(
  sink: SessionSink,
  { userId, secret = DEV_SESSION_SECRET, expiresInSeconds = 3600 }: MintSessionOptions,
): Promise<MintedSession> {
  const token = randomBytes(32).toString("base64url");
  const id = randomBytes(16).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const row: SessionRow = {
    id,
    token,
    userId,
    expiresAt: now + expiresInSeconds,
    createdAt: now,
    updatedAt: now,
    ipAddress: "",
    userAgent: "",
  };

  if (typeof sink === "string") {
    const db = new Database(sink);
    insertSessionRow(db, row);
    db.close();
  } else if (sink instanceof Database) {
    insertSessionRow(sink, row);
  } else {
    sink.insertSession(row);
  }

  const value = await signSessionToken(token, secret);
  return { token, name: SESSION_COOKIE_NAME, value };
}

/**
 * A Playwright cookie authenticating the browser context as `userId` (a `users.id`).
 * Mints a real BetterAuth session row in the local D1 and returns the signed
 * `better-auth.session_token` cookie. `d1Path` is the local miniflare D1 file.
 */
export async function sessionCookie(d1Path: string, userId: string) {
  const { name, value } = await mintBetterAuthSession(d1Path, { userId });
  return { name, value, domain: "localhost", path: "/" };
}
