import { type Db, regScopeMembers } from "@brika/store-db";
import { and, eq } from "drizzle-orm";

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

  /** How many admins the scope has (used to enforce the "at least one admin" rule). */
  async adminCount(scope: string): Promise<number> {
    const rows = await this.#db
      .select({ role: regScopeMembers.role })
      .from(regScopeMembers)
      .where(and(eq(regScopeMembers.scope, scope), eq(regScopeMembers.role, "admin")));
    return rows.length;
  }

  /** Add a member or change an existing member's role. */
  async upsert(scope: string, member: MemberRef, role: ScopeRole): Promise<void> {
    await this.#db
      .insert(regScopeMembers)
      .values({ scope, provider: member.provider, memberId: member.id, role })
      .onConflictDoUpdate({
        target: [regScopeMembers.scope, regScopeMembers.provider, regScopeMembers.memberId],
        set: { role },
      });
  }

  /** Remove a member from the scope. */
  async remove(scope: string, member: MemberRef): Promise<void> {
    await this.#db
      .delete(regScopeMembers)
      .where(
        and(
          eq(regScopeMembers.scope, scope),
          eq(regScopeMembers.provider, member.provider),
          eq(regScopeMembers.memberId, member.id),
        ),
      );
  }
}
