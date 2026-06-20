import type { MemberRef, OrgMember, OrgMembers, OrgRole } from "@brika/registry-core";
import { and, countDistinct, eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import { regOrgMembers } from "../schema";

/** Narrow a stored role string to the `OrgRole` union (the column only ever holds these). */
function toRole(value: string): OrgRole {
  return value === "admin" ? "admin" : "member";
}

/**
 * Cloudflare D1 implementation of the {@link OrgMembers} domain port (org
 * membership). Publishing under any scope the org owns is gated on being a member;
 * managing the org (members, scopes, display name) requires the `admin` role. The org
 * creator is seeded as the first admin (see the org controller). The "at least one admin"
 * invariant is enforced here in SQL (see {@link demoteFromAdmin}/{@link remove}).
 */
export class D1OrgMembers implements OrgMembers {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  /** This identity's role in the org, or null when it is not a member. */
  async roleOf(org: string, member: MemberRef): Promise<OrgRole | null> {
    const rows = await this.#db
      .select({ role: regOrgMembers.role })
      .from(regOrgMembers)
      .where(
        and(
          eq(regOrgMembers.orgSlug, org),
          eq(regOrgMembers.provider, member.provider),
          eq(regOrgMembers.memberId, member.id),
        ),
      )
      .limit(1);
    const role = rows[0]?.role;
    return role === undefined ? null : toRole(role);
  }

  /** All members of an org. */
  async list(org: string): Promise<OrgMember[]> {
    const rows = await this.#db.select().from(regOrgMembers).where(eq(regOrgMembers.orgSlug, org));
    return rows.map((row) => ({
      provider: row.provider,
      id: row.memberId,
      role: toRole(row.role),
    }));
  }

  /** Add a member or change an existing member's role (no last-admin guard - see below). */
  async upsert(org: string, member: MemberRef, role: OrgRole): Promise<void> {
    await this.#db
      .insert(regOrgMembers)
      .values({ orgSlug: org, provider: member.provider, memberId: member.id, role })
      .onConflictDoUpdate({
        target: [regOrgMembers.orgSlug, regOrgMembers.provider, regOrgMembers.memberId],
        set: { role },
      });
  }

  /**
   * Demote an admin to member, unless they are the org's last admin. Returns true when the
   * demotion happened, false when it was refused to keep the invariant.
   *
   * The "more than one admin" test is a subquery INSIDE the UPDATE, so the check and the
   * write are one statement: concurrent demotions of different admins serialize (SQLite
   * has a single writer), and the second sees the post-first count and is refused - the
   * read-then-write TOCTOU that a separate count() would have is gone.
   */
  async demoteFromAdmin(org: string, member: MemberRef): Promise<boolean> {
    await this.#db
      .update(regOrgMembers)
      .set({ role: "member" })
      .where(
        and(
          eq(regOrgMembers.orgSlug, org),
          eq(regOrgMembers.provider, member.provider),
          eq(regOrgMembers.memberId, member.id),
          eq(regOrgMembers.role, "admin"),
          this.#moreThanOneAdmin(org),
        ),
      );
    return (await this.roleOf(org, member)) === "member";
  }

  /**
   * Remove a member, unless they are the org's last admin. Returns true when the row was
   * removed, false when it was refused to keep the invariant. Same atomic guard as
   * {@link demoteFromAdmin}: non-admins are always removable; the last admin is not.
   */
  async remove(org: string, member: MemberRef): Promise<boolean> {
    await this.#db
      .delete(regOrgMembers)
      .where(
        and(
          eq(regOrgMembers.orgSlug, org),
          eq(regOrgMembers.provider, member.provider),
          eq(regOrgMembers.memberId, member.id),
          sql`(${regOrgMembers.role} <> 'admin' or ${this.#moreThanOneAdmin(org)})`,
        ),
      );
    return (await this.roleOf(org, member)) === null;
  }

  /** How many distinct orgs this identity is an admin of (the per-account org cap). */
  async countOrgsAdminedBy(member: MemberRef): Promise<number> {
    const rows = await this.#db
      .select({ n: countDistinct(regOrgMembers.orgSlug) })
      .from(regOrgMembers)
      .where(
        and(
          eq(regOrgMembers.provider, member.provider),
          eq(regOrgMembers.memberId, member.id),
          eq(regOrgMembers.role, "admin"),
        ),
      );
    return rows[0]?.n ?? 0;
  }

  /** SQL predicate: the org currently has more than one admin (evaluated in-statement). */
  #moreThanOneAdmin(org: string) {
    return sql`(select count(*) from ${regOrgMembers} where ${regOrgMembers.orgSlug} = ${org} and ${regOrgMembers.role} = 'admin') > 1`;
  }
}
