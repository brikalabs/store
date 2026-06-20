/**
 * Organisation membership port. The domain defines WHO belongs to an org and with what
 * role; a concrete adapter (Cloudflare D1 today) implements it in the registry app.
 * Publishing under any scope an org owns is gated on org membership, and managing an org
 * requires the `admin` role, so the authorization core depends on this interface rather
 * than on any database.
 */

/** An org role: `admin` manages the org + its members + scopes; `member` may publish. */
export type OrgRole = "admin" | "member";

/** A provider-qualified reference to one identity (an org member). */
export interface MemberRef {
  readonly provider: string;
  readonly id: string;
}

/** One org member: a provider-qualified identity with a role. */
export interface OrgMember extends MemberRef {
  readonly role: OrgRole;
}

/**
 * Read + write access to org membership. The "an org always keeps at least one admin"
 * invariant is the implementation's responsibility: {@link demoteFromAdmin} and
 * {@link remove} must refuse to act on the last admin, atomically (so concurrent calls
 * cannot both pass), and report whether they applied. Callers treat `false` as "refused
 * to preserve the invariant".
 */
export interface OrgMembers {
  /** This identity's role in the org, or null when it is not a member. */
  roleOf(org: string, member: MemberRef): Promise<OrgRole | null>;
  /** All members of an org. */
  list(org: string): Promise<OrgMember[]>;
  /** Add a member or change an existing member's role (no last-admin guard - callers gate). */
  upsert(org: string, member: MemberRef, role: OrgRole): Promise<void>;
  /** Demote an admin to member unless they are the last admin; returns whether it applied. */
  demoteFromAdmin(org: string, member: MemberRef): Promise<boolean>;
  /** Remove a member unless they are the last admin; returns whether it applied. */
  remove(org: string, member: MemberRef): Promise<boolean>;
  /** How many orgs this identity administers, for the per-account org cap (ORG-005). */
  countOrgsAdminedBy(member: MemberRef): Promise<number>;
}
