import type { ScopeRole } from "@brika/registry-core";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../client";
import {
  regDistTags,
  regPackages,
  regScopeMembers,
  regScopes,
  regTokens,
  regVersions,
} from "../schema";

/** Read-model projections over the `reg_*` tables for the console UIs (plain reads, not domain ports). */

/** A scope a member can manage (the scope IS the account), with the member's role. */
export interface MemberScope {
  readonly scope: string;
  readonly role: ScopeRole;
  /** The scope's verified display name (null falls back to the scope). */
  readonly displayName: string | null;
}

/** Every scope a `userId` is a member of, sorted by scope; backs the storefront's "do I own this package" check. */
export async function listScopesForMember(db: Db, userId: string): Promise<MemberScope[]> {
  const rows = await db
    .select({
      scope: regScopeMembers.scope,
      role: regScopeMembers.role,
      displayName: regScopes.displayName,
    })
    .from(regScopeMembers)
    .innerJoin(regScopes, eq(regScopes.scope, regScopeMembers.scope))
    .where(eq(regScopeMembers.userId, userId))
    .orderBy(regScopeMembers.scope);
  return rows.map((row) => ({
    scope: row.scope,
    role: row.role === "admin" ? "admin" : "member",
    displayName: row.displayName,
  }));
}

/**
 * Every package name published under any of `scopes`. Unlike the public catalog this includes
 * fully-yanked packages, so the owner dashboard can list and relist them.
 */
export async function listPackageNamesForScopes(db: Db, scopes: string[]): Promise<string[]> {
  if (scopes.length === 0) return [];
  const rows = await db
    .select({ name: regPackages.name })
    .from(regPackages)
    .where(inArray(regPackages.scope, scopes));
  return rows.map((row) => row.name);
}

/**
 * A package in the operator console directory: scope, latest version, and takedown/yank counts.
 * Includes packages with no visible version (unlike the public catalog) so an operator can restore them.
 */
export interface OperatorPackage {
  readonly name: string;
  readonly scope: string | null;
  /** Owning scope's verified display name, or null when the scope is unclaimed. */
  readonly scopeDisplayName: string | null;
  readonly latestVersion: string | null;
  readonly versionCount: number;
  readonly takenDownCount: number;
  readonly yankedCount: number;
}

/** Every package with moderation counts, newest first. Aggregates in memory (the bounded scope is small). */
export async function listAllPackages(db: Db): Promise<OperatorPackage[]> {
  const [packages, latest, versions] = await Promise.all([
    db
      .select({
        name: regPackages.name,
        scope: regPackages.scope,
        createdAt: regPackages.createdAt,
        scopeDisplayName: regScopes.displayName,
      })
      .from(regPackages)
      .leftJoin(regScopes, eq(regScopes.scope, regPackages.scope)),
    db
      .select({ name: regDistTags.name, version: regDistTags.version })
      .from(regDistTags)
      .where(eq(regDistTags.tag, "latest")),
    db
      .select({
        name: regVersions.name,
        takedown: regVersions.takedown,
        yanked: regVersions.yanked,
      })
      .from(regVersions),
  ]);

  const latestByName = new Map(latest.map((row) => [row.name, row.version]));
  const counts = new Map<string, { total: number; takenDown: number; yanked: number }>();
  for (const v of versions) {
    const c = counts.get(v.name) ?? { total: 0, takenDown: 0, yanked: 0 };
    c.total += 1;
    if (v.takedown !== null) c.takenDown += 1;
    if (v.yanked) c.yanked += 1;
    counts.set(v.name, c);
  }

  return packages
    .map((pkg) => {
      const c = counts.get(pkg.name) ?? { total: 0, takenDown: 0, yanked: 0 };
      return {
        name: pkg.name,
        scope: pkg.scope,
        scopeDisplayName: pkg.scopeDisplayName,
        latestVersion: latestByName.get(pkg.name) ?? null,
        versionCount: c.total,
        takenDownCount: c.takenDown,
        yankedCount: c.yanked,
        createdAt: pkg.createdAt,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ createdAt: _createdAt, ...rest }) => rest);
}

/**
 * Resolve an account's display name + avatar by Brika `userId` for audit/`whoami`. The account lives
 * in the store's `users` table, not this package's `reg_*` schema but the SAME D1 database, so rather
 * than a cross-app drizzle dependency we read it with one parameterized raw SQL query over the client.
 * Best-effort display enrichment, never an authorization input, so any read error resolves to all-nulls.
 *
 * ponytail: avatar is the provider `image`; the uploaded-avatar URL (built from
 * `avatar_version` + the assets base) is web-only, so the audit log shows the provider avatar.
 */
export async function resolveActor(
  db: Db,
  userId: string,
): Promise<{ displayName: string | null; avatarUrl: string | null }> {
  let rows: Array<{ display_name: string | null; name: string | null; image: string | null }>;
  try {
    rows = await db.all<{ display_name: string | null; name: string | null; image: string | null }>(
      sql`SELECT display_name, name, image FROM users WHERE id = ${userId} LIMIT 1`,
    );
  } catch {
    return { displayName: null, avatarUrl: null };
  }
  const row = rows[0];
  if (row === undefined) return { displayName: null, avatarUrl: null };
  const display = typeof row.display_name === "string" ? row.display_name.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const image = typeof row.image === "string" && row.image.length > 0 ? row.image : null;
  return { displayName: display || name || null, avatarUrl: image };
}

/**
 * A publish token's metadata. Only the SHA-256 `tokenHash` is stored (plaintext is shown once,
 * never persisted), so the UI identifies a token by a hash prefix plus these timestamps.
 */
export interface SubjectToken {
  readonly tokenHash: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly lastUsedAt: number | null;
}

/** An account's publish tokens, newest first. */
export async function listSubjectTokens(db: Db, userId: string): Promise<SubjectToken[]> {
  return db
    .select({
      tokenHash: regTokens.tokenHash,
      createdAt: regTokens.createdAt,
      expiresAt: regTokens.expiresAt,
      lastUsedAt: regTokens.lastUsedAt,
    })
    .from(regTokens)
    .where(eq(regTokens.userId, userId))
    .orderBy(desc(regTokens.createdAt));
}

/**
 * Revoke a token by hash, but only when it belongs to `userId` - one account can never revoke
 * another's token. Returns false when the caller owns no such token (the route maps that to 404).
 */
export async function revokeTokenByHash(
  db: Db,
  userId: string,
  tokenHash: string,
): Promise<boolean> {
  const owned = await db
    .select({ hash: regTokens.tokenHash })
    .from(regTokens)
    .where(and(eq(regTokens.tokenHash, tokenHash), eq(regTokens.userId, userId)))
    .limit(1);
  if (owned.length === 0) return false;
  await db.delete(regTokens).where(eq(regTokens.tokenHash, tokenHash));
  return true;
}
