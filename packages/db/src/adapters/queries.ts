import type { ScopeRole } from "@brika/registry-core";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { regScopeMembers, regScopes, regTokens } from "../schema";

/**
 * Read-model projections over the `reg_*` tables for the console UIs. These are plain
 * reads (not authorization-bearing use cases, so not domain ports): "the scopes I belong
 * to", "my tokens", and an ownership-guarded token revoke. They live next to the adapters
 * because they are the same SQL layer, and let the web app avoid hand-writing drizzle.
 */

/** A scope a member belongs to, with their role and the scope's verified display name. */
export interface MemberScope {
  readonly scope: string;
  readonly role: ScopeRole;
  readonly displayName: string | null;
}

/** Every scope `(provider, memberId)` is a member of, with their role, sorted by name. */
export async function listScopesForMember(
  db: Db,
  provider: string,
  memberId: string,
): Promise<MemberScope[]> {
  const rows = await db
    .select({
      scope: regScopeMembers.scope,
      role: regScopeMembers.role,
      displayName: regScopes.displayName,
    })
    .from(regScopeMembers)
    .innerJoin(regScopes, eq(regScopeMembers.scope, regScopes.scope))
    .where(and(eq(regScopeMembers.provider, provider), eq(regScopeMembers.memberId, memberId)))
    .orderBy(regScopeMembers.scope);
  return rows.map((row) => ({
    scope: row.scope,
    role: row.role === "admin" ? "admin" : "member",
    displayName: row.displayName,
  }));
}

/**
 * A publish token's metadata. `reg_tokens` stores only the SHA-256 `tokenHash` (the
 * plaintext is shown once at issue and never persisted), so the UI identifies a token by
 * a short prefix of its hash plus these timestamps (unix epoch seconds). There is no label.
 */
export interface SubjectToken {
  readonly tokenHash: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly lastUsedAt: number | null;
}

/** A subject's publish tokens, newest first. */
export async function listSubjectTokens(
  db: Db,
  provider: string,
  subject: string,
): Promise<SubjectToken[]> {
  return db
    .select({
      tokenHash: regTokens.tokenHash,
      createdAt: regTokens.createdAt,
      expiresAt: regTokens.expiresAt,
      lastUsedAt: regTokens.lastUsedAt,
    })
    .from(regTokens)
    .where(and(eq(regTokens.provider, provider), eq(regTokens.subject, subject)))
    .orderBy(desc(regTokens.createdAt));
}

/**
 * Revoke a token by its hash, but only when it belongs to `(provider, subject)` - one
 * user can never revoke another's token. Returns false when no such token is owned by the
 * caller (the route maps that to 404), true when it was removed.
 */
export async function revokeTokenByHash(
  db: Db,
  provider: string,
  subject: string,
  tokenHash: string,
): Promise<boolean> {
  const owned = await db
    .select({ hash: regTokens.tokenHash })
    .from(regTokens)
    .where(
      and(
        eq(regTokens.tokenHash, tokenHash),
        eq(regTokens.provider, provider),
        eq(regTokens.subject, subject),
      ),
    )
    .limit(1);
  if (owned.length === 0) return false;
  await db.delete(regTokens).where(eq(regTokens.tokenHash, tokenHash));
  return true;
}
