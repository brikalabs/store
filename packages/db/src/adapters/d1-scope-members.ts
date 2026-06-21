import type { ScopeMember, ScopeMembers, ScopeRole } from "@brika/registry-core";
import { and, countDistinct, eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import { regScopeMembers } from "../schema";

/** Narrow a stored role string to the `ScopeRole` union (the column only ever holds these). */
function toRole(value: string): ScopeRole {
  return value === "admin" ? "admin" : "member";
}

/**
 * Cloudflare D1 implementation of the {@link ScopeMembers} domain port (scope
 * membership). Publishing under a scope is gated on being a member; managing the scope
 * (members, display name, profile, domains) requires the `admin` role. The scope creator
 * is seeded as the first admin (see the scope controller). The "at least one admin"
 * invariant is enforced here in SQL (see {@link demoteFromAdmin}/{@link remove}).
 */
export class D1ScopeMembers implements ScopeMembers {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** This account's role in the scope, or null when it is not a member. */
  async roleOf(scope: string, userId: string): Promise<ScopeRole | null> {
    const rows = await this.#db
      .select({ role: regScopeMembers.role })
      .from(regScopeMembers)
      .where(and(eq(regScopeMembers.scope, scope), eq(regScopeMembers.userId, userId)))
      .limit(1);
    const role = rows[0]?.role;
    return role === undefined ? null : toRole(role);
  }

  /** All members of a scope. */
  async list(scope: string): Promise<ScopeMember[]> {
    const rows = await this.#db
      .select()
      .from(regScopeMembers)
      .where(eq(regScopeMembers.scope, scope));
    return rows.map((row) => ({
      userId: row.userId,
      role: toRole(row.role),
    }));
  }

  /** Add a member or change an existing member's role (no last-admin guard - see below). */
  async upsert(scope: string, userId: string, role: ScopeRole): Promise<void> {
    await this.#db
      .insert(regScopeMembers)
      .values({ scope, userId, role })
      .onConflictDoUpdate({
        target: [regScopeMembers.scope, regScopeMembers.userId],
        set: { role },
      });
  }

  /**
   * Demote an admin to member, unless they are the scope's last admin. Returns true when the
   * demotion happened, false when it was refused to keep the invariant.
   *
   * The "more than one admin" test is a subquery INSIDE the UPDATE, so the check and the
   * write are one statement: concurrent demotions of different admins serialize (SQLite
   * has a single writer), and the second sees the post-first count and is refused - the
   * read-then-write TOCTOU that a separate count() would have is gone.
   */
  async demoteFromAdmin(scope: string, userId: string): Promise<boolean> {
    await this.#db
      .update(regScopeMembers)
      .set({ role: "member" })
      .where(
        and(
          eq(regScopeMembers.scope, scope),
          eq(regScopeMembers.userId, userId),
          eq(regScopeMembers.role, "admin"),
          this.#moreThanOneAdmin(scope),
        ),
      );
    return (await this.roleOf(scope, userId)) === "member";
  }

  /**
   * Remove a member, unless they are the scope's last admin. Returns true when the row was
   * removed, false when it was refused to keep the invariant. Same atomic guard as
   * {@link demoteFromAdmin}: non-admins are always removable; the last admin is not.
   */
  async remove(scope: string, userId: string): Promise<boolean> {
    await this.#db
      .delete(regScopeMembers)
      .where(
        and(
          eq(regScopeMembers.scope, scope),
          eq(regScopeMembers.userId, userId),
          sql`(${regScopeMembers.role} <> 'admin' or ${this.#moreThanOneAdmin(scope)})`,
        ),
      );
    return (await this.roleOf(scope, userId)) === null;
  }

  /** How many distinct scopes this account is an admin of (the per-account scope cap). */
  async countScopesAdminedBy(userId: string): Promise<number> {
    const rows = await this.#db
      .select({ n: countDistinct(regScopeMembers.scope) })
      .from(regScopeMembers)
      .where(and(eq(regScopeMembers.userId, userId), eq(regScopeMembers.role, "admin")));
    return rows[0]?.n ?? 0;
  }

  /** SQL predicate: the scope currently has more than one admin (evaluated in-statement). */
  #moreThanOneAdmin(scope: string) {
    return sql`(select count(*) from ${regScopeMembers} where ${regScopeMembers.scope} = ${scope} and ${regScopeMembers.role} = 'admin') > 1`;
  }
}
