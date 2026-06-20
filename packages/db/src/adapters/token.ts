import type { TokenPrincipal, TokenStore } from "@brika/registry-core";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { regTokens } from "../schema";

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
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function issueToken(db: Db, subject: string, provider = "github"): Promise<string> {
  const token = `${TOKEN_PREFIX}${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(regTokens)
    .values({ tokenHash: await hashToken(token), provider, subject, expiresAt: now + TTL_SECONDS });
  return token;
}

/** Revoke a token by deleting its row. A no-op (still resolves) for unknown tokens. */
export async function revokeToken(db: Db, token: string): Promise<void> {
  if (!token.startsWith(TOKEN_PREFIX)) return;
  await db.delete(regTokens).where(eq(regTokens.tokenHash, await hashToken(token)));
}

export async function verifyToken(
  db: Db,
  token: string,
): Promise<{ provider: string; subject: string } | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const rows = await db
    .select()
    .from(regTokens)
    .where(eq(regTokens.tokenHash, await hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (row === undefined || row.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return { provider: row.provider, subject: row.subject };
}

/**
 * D1 implementation of the {@link TokenStore} port over `reg_tokens`. Thin adapter over the
 * issue/verify/revoke functions above (which own the crypto + hashing); auth and the
 * device flow depend on this port, not on the database.
 */
export class D1TokenStore implements TokenStore {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  issue(subject: string, provider = "github"): Promise<string> {
    return issueToken(this.#db, subject, provider);
  }

  verify(token: string): Promise<TokenPrincipal | null> {
    return verifyToken(this.#db, token);
  }

  revoke(token: string): Promise<void> {
    return revokeToken(this.#db, token);
  }
}
