/**
 * Scope membership port. The domain defines WHO belongs to a scope and with what role;
 * a concrete adapter (Cloudflare D1 today) implements it in the registry app. Publishing
 * is gated on membership and managing a scope requires the `admin` role, so the
 * authorization core depends on this interface rather than on any database.
 */

/** A scope role: `admin` manages the scope + its members; `member` may publish under it. */
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
 * Read + write access to scope membership. The "a scope always keeps at least one admin"
 * invariant is the implementation's responsibility: {@link demoteFromAdmin} and
 * {@link remove} must refuse to act on the last admin, atomically (so concurrent calls
 * cannot both pass), and report whether they applied. Callers treat `false` as "refused
 * to preserve the invariant".
 */
export interface ScopeMembers {
  /** This identity's role in the scope, or null when it is not a member. */
  roleOf(scope: string, member: MemberRef): Promise<ScopeRole | null>;
  /** All members of a scope. */
  list(scope: string): Promise<ScopeMember[]>;
  /** Add a member or change an existing member's role (no last-admin guard - callers gate). */
  upsert(scope: string, member: MemberRef, role: ScopeRole): Promise<void>;
  /** Demote an admin to member unless they are the last admin; returns whether it applied. */
  demoteFromAdmin(scope: string, member: MemberRef): Promise<boolean>;
  /** Remove a member unless they are the last admin; returns whether it applied. */
  remove(scope: string, member: MemberRef): Promise<boolean>;
}
