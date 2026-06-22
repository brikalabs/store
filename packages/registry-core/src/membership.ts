import { token } from "@brika/di";

/**
 * Scope membership port: WHO belongs to a scope and with what role. Publishing is gated on
 * membership and managing a scope requires `admin`, so the authorization core depends on this
 * interface rather than on any database.
 */

/** A scope role: `admin` manages the scope + its members; `member` may publish. */
export type ScopeRole = "admin" | "member";

/** One scope member: a Brika account id with a role. */
export interface ScopeMember {
  readonly userId: string;
  readonly role: ScopeRole;
}

/**
 * Read + write access to scope membership. INVARIANT: a scope always keeps at least one admin -
 * {@link demoteFromAdmin} and {@link remove} must refuse to act on the last admin atomically (so
 * concurrent calls cannot both pass) and return `false` when they refuse.
 */
export interface ScopeMembers {
  /** This account's role in the scope, or null when it is not a member. */
  roleOf(scope: string, userId: string): Promise<ScopeRole | null>;
  /** All members of a scope. */
  list(scope: string): Promise<ScopeMember[]>;
  /** Add a member or change an existing member's role (no last-admin guard - callers gate). */
  upsert(scope: string, userId: string, role: ScopeRole): Promise<void>;
  /** Demote an admin to member unless they are the last admin; returns whether it applied. */
  demoteFromAdmin(scope: string, userId: string): Promise<boolean>;
  /** Remove a member unless they are the last admin; returns whether it applied. */
  remove(scope: string, userId: string): Promise<boolean>;
  /** How many scopes this account administers, for the per-account scope cap (ORG-005). */
  countScopesAdminedBy(userId: string): Promise<number>;
}
/** DI token for the {@link ScopeMembers} port. */
export const ScopeMembers = token<ScopeMembers>("ScopeMembers");
