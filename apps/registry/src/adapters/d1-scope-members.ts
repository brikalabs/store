import { type Db, regScopeMembers } from "@brika/store-db";
import { and, eq, sql } from "drizzle-orm";

/** A scope role: `admin` manages the scope + members; `member` may publish under it. */
export type ScopeRole = "admin" | "member";

/** A provider-qualified reference to one identity (a scope member). */
export interface MemberRef {
  readonly provider: string;
  readonly id: string;
}

/** One scope member: a provider-qualified identity with a role. */
export interface ScopeMember extends MemberRef {
  readonly role: ScopeRole;
}

/**
 * Scope membership (JSR-style). Publishing is gated on being a member of the scope;
 * managing the scope (members, display name) requires the `admin` role. The scope
 * creator is seeded as the first admin (see the scope controller).
 */
export class D1ScopeMembers {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** This identity's role in the scope, or null when it is not a member. */
  async roleOf(scope: string, member: MemberRef): Promise<ScopeRole | null> {
    const rows = await this.#db
      .select({ role: regScopeMembers.role })
      .from(regScopeMembers)
      .where(
        and(
          eq(regScopeMembers.scope, scope),
          eq(regScopeMembers.provider, member.provider),
          eq(regScopeMembers.memberId, member.id),
        ),
      )
      .limit(1);
    return (rows[0]?.role as ScopeRole | undefined) ?? null;
  }

  /** All members of a scope. */
  async list(scope: string): Promise<ScopeMember[]> {
    const rows = await this.#db
      .select()
      .from(regScopeMembers)
      .where(eq(regScopeMembers.scope, scope));
    return rows.map((row) => ({
      provider: row.provider,
      id: row.memberId,
      role: row.role as ScopeRole,
    }));
  }

  /** Add a member or change an existing member's role (no last-admin guard - see below). */
  async upsert(scope: string, member: MemberRef, role: ScopeRole): Promise<void> {
    await this.#db
      .insert(regScopeMembers)
      .values({ scope, provider: member.provider, memberId: member.id, role })
      .onConflictDoUpdate({
        target: [regScopeMembers.scope, regScopeMembers.provider, regScopeMembers.memberId],
        set: { role },
      });
  }

  /**
   * Demote an admin to member, unless they are the scope's last admin. Returns true when
   * the demotion happened, false when it was refused to keep the invariant.
   *
   * The "more than one admin" test is a subquery INSIDE the UPDATE, so the check and the
   * write are one statement: concurrent demotions of different admins serialize (SQLite
   * has a single writer), and the second sees the post-first count and is refused - the
   * read-then-write TOCTOU that a separate count() would have is gone.
   */
  async demoteFromAdmin(scope: string, member: MemberRef): Promise<boolean> {
    await this.#db
      .update(regScopeMembers)
      .set({ role: "member" })
      .where(
        and(
          eq(regScopeMembers.scope, scope),
          eq(regScopeMembers.provider, member.provider),
          eq(regScopeMembers.memberId, member.id),
          eq(regScopeMembers.role, "admin"),
          this.#moreThanOneAdmin(scope),
        ),
      );
    return (await this.roleOf(scope, member)) === "member";
  }

  /**
   * Remove a member, unless they are the scope's last admin. Returns true when the row
   * was removed, false when it was refused to keep the invariant. Same atomic guard as
   * {@link demoteFromAdmin}: non-admins are always removable; the last admin is not.
   */
  async remove(scope: string, member: MemberRef): Promise<boolean> {
    await this.#db
      .delete(regScopeMembers)
      .where(
        and(
          eq(regScopeMembers.scope, scope),
          eq(regScopeMembers.provider, member.provider),
          eq(regScopeMembers.memberId, member.id),
          sql`(${regScopeMembers.role} <> 'admin' or ${this.#moreThanOneAdmin(scope)})`,
        ),
      );
    return (await this.roleOf(scope, member)) === null;
  }

  /** SQL predicate: the scope currently has more than one admin (evaluated in-statement). */
  #moreThanOneAdmin(scope: string) {
    return sql`(select count(*) from ${regScopeMembers} where ${regScopeMembers.scope} = ${scope} and ${regScopeMembers.role} = 'admin') > 1`;
  }
}
