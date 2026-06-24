import type { Page, ScopeRole } from "@brika/registry-core";
import { and, count, desc, eq, inArray, like, sql } from "drizzle-orm";
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
  /** ISO timestamp of the most recently published version, or null when the package has none. */
  readonly updatedAt: string | null;
}

/**
 * A page of packages with moderation-relevant counts, newest published first, optionally narrowed
 * by a case-insensitive name substring (`q`). Search and pagination are pushed down to SQL: the
 * `total` is a `COUNT` over the (filtered) packages, and only this page's names have their `latest`
 * dist-tag and version rows fetched, so we never load every version to render one screen. The small
 * per-page count aggregation still happens in memory, which keeps it simple and exact.
 */
export async function listAllPackages(
  db: Db,
  opts: { q?: string; limit: number; offset: number },
): Promise<Page<OperatorPackage>> {
  const needle = opts.q?.trim().toLowerCase();
  const where = needle ? like(regPackages.name, `%${needle}%`) : undefined;

  const totalRows = await db.select({ value: count() }).from(regPackages).where(where);
  const total = totalRows[0]?.value ?? 0;

  const packages = await db
    .select({
      name: regPackages.name,
      scope: regPackages.scope,
      scopeDisplayName: regScopes.displayName,
    })
    .from(regPackages)
    .leftJoin(regScopes, eq(regScopes.scope, regPackages.scope))
    .where(where)
    .orderBy(desc(regPackages.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);

  const names = packages.map((pkg) => pkg.name);
  if (names.length === 0) return { items: [], total, limit: opts.limit, offset: opts.offset };

  const [latest, versions] = await Promise.all([
    db
      .select({ name: regDistTags.name, version: regDistTags.version })
      .from(regDistTags)
      .where(and(eq(regDistTags.tag, "latest"), inArray(regDistTags.name, names))),
    db
      .select({
        name: regVersions.name,
        takedown: regVersions.takedown,
        yanked: regVersions.yanked,
        publishedAt: regVersions.publishedAt,
      })
      .from(regVersions)
      .where(inArray(regVersions.name, names)),
  ]);

  const latestByName = new Map(latest.map((row) => [row.name, row.version]));
  const zeroCounts = () => ({ total: 0, takenDown: 0, yanked: 0, lastPublished: 0 });
  const counts = new Map<string, ReturnType<typeof zeroCounts>>();
  for (const v of versions) {
    const c = counts.get(v.name) ?? zeroCounts();
    c.total += 1;
    if (v.takedown !== null) c.takenDown += 1;
    if (v.yanked) c.yanked += 1;
    if (v.publishedAt > c.lastPublished) c.lastPublished = v.publishedAt;
    counts.set(v.name, c);
  }

  const items = packages.map((pkg) => {
    const c = counts.get(pkg.name) ?? zeroCounts();
    return {
      name: pkg.name,
      scope: pkg.scope,
      scopeDisplayName: pkg.scopeDisplayName,
      latestVersion: latestByName.get(pkg.name) ?? null,
      versionCount: c.total,
      takenDownCount: c.takenDown,
      yankedCount: c.yanked,
      updatedAt: c.lastPublished > 0 ? new Date(c.lastPublished * 1000).toISOString() : null,
    };
  });

  return { items, total, limit: opts.limit, offset: opts.offset };
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
