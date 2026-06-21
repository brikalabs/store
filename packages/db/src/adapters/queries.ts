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

/**
 * Read-model projections over the `reg_*` tables for the console UIs. These are plain
 * reads (not authorization-bearing use cases, so not domain ports): "the scopes I can
 * manage", "my tokens", and an ownership-guarded token revoke. They live next to the
 * adapters because they are the same SQL layer, and let the web app avoid hand-writing
 * drizzle.
 */

/** A scope a member can manage (the scope IS the account), with the member's role. */
export interface MemberScope {
  readonly scope: string;
  readonly role: ScopeRole;
  /** The scope's verified display name (null falls back to the scope). */
  readonly displayName: string | null;
}

/**
 * Every scope `(provider, memberId)` can manage: the scopes they are a member of, sorted by
 * scope. Used by the storefront to decide whether the signed-in user owns a package's scope
 * (publishing is gated on scope membership).
 */
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
    .innerJoin(regScopes, eq(regScopes.scope, regScopeMembers.scope))
    .where(and(eq(regScopeMembers.provider, provider), eq(regScopeMembers.memberId, memberId)))
    .orderBy(regScopeMembers.scope);
  return rows.map((row) => ({
    scope: row.scope,
    role: row.role === "admin" ? "admin" : "member",
    displayName: row.displayName,
  }));
}

/**
 * Every package name published under any of `scopes`, regardless of whether it still has an
 * installable (non-yanked) version. Unlike the public catalog this includes fully-yanked
 * packages, so the owner dashboard can list and relist them. Empty `scopes` short-circuits to
 * no rows (a user who owns no scope owns no package).
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
 * A package as listed in the operator console directory: its owning scope, latest version,
 * and how many of its versions are taken down or yanked. Unlike the public catalog this
 * includes packages with no non-hidden version, so an operator can find and restore a
 * fully-taken-down package.
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

/**
 * Every package with moderation-relevant counts, newest published first. Reads the bounded
 * `reg_*` tables and aggregates in memory (like the catalog reader) rather than with SQL
 * aggregates: the hosted scope is small and this keeps the query simple and exact.
 */
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
 * Resolve a human display name for a GitHub login, for the CLI's `login`/`whoami`
 * output. The account identity lives in the store's `users`/`user_profiles` tables,
 * which are NOT part of this package's `reg_*` drizzle schema (they belong to the
 * store web app), but they share the SAME D1 database the registry binds. Rather than
 * take a cross-app drizzle dependency we read them with a single parameterized raw SQL
 * query over the same client: `github_login -> users.login -> user_profiles.display_name`,
 * falling back to `users.name`, then to null (the caller substitutes the login).
 *
 * Returns null when the login has no matching account, or has an account but neither a
 * profile display name nor a `users.name` - the caller falls back to the github login.
 * It is best-effort display enrichment, never an authorization input, so any read error
 * (e.g. the store tables not present in a given database) resolves to null rather than
 * throwing: the caller falls back to the github login.
 */
export async function resolveDisplayName(db: Db, githubLogin: string): Promise<string | null> {
  let rows: Array<{ display_name: string | null; name: string | null }>;
  try {
    rows = await db.all<{ display_name: string | null; name: string | null }>(
      sql`SELECT up.display_name AS display_name, u.name AS name
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.id
          WHERE u.login = ${githubLogin}
          LIMIT 1`,
    );
  } catch {
    return null;
  }
  const row = rows[0];
  if (row === undefined) return null;
  const displayName = typeof row.display_name === "string" ? row.display_name.trim() : "";
  if (displayName.length > 0) return displayName;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  return name.length > 0 ? name : null;
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
