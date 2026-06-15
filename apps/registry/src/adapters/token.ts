import { type Db, regTokens } from "@brika/store-db";
import { eq } from "drizzle-orm";

/**
 * Registry publish tokens for local `brika publish`. The token is shown once;
 * only its SHA-256 hash is stored, so a database read cannot recover it.
 */

const TOKEN_PREFIX = "brika_";
const TTL_SECONDS = 90 * 24 * 60 * 60;

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const view = new Uint8Array(bytes.byteLength);
  view.set(bytes);
  return toHex(await crypto.subtle.digest("SHA-256", view));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function issueToken(db: Db, githubLogin: string): Promise<string> {
  const token = `${TOKEN_PREFIX}${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(regTokens)
    .values({ tokenHash: await hashToken(token), githubLogin, expiresAt: now + TTL_SECONDS });
  return token;
}

/** Revoke a token by deleting its row. A no-op (still resolves) for unknown tokens. */
export async function revokeToken(db: Db, token: string): Promise<void> {
  if (!token.startsWith(TOKEN_PREFIX)) return;
  await db.delete(regTokens).where(eq(regTokens.tokenHash, await hashToken(token)));
}

export async function verifyToken(db: Db, token: string): Promise<{ githubLogin: string } | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const rows = await db
    .select()
    .from(regTokens)
    .where(eq(regTokens.tokenHash, await hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (row === undefined || row.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return { githubLogin: row.githubLogin };
}
