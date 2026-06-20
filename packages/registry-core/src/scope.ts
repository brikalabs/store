import { REGISTRY_LIMITS } from "./limits";
import type { MemberRef, ScopeMember, ScopeMembers, ScopeRole } from "./membership";
import type { PublishIdentity } from "./publish";

/** A scope record: its provider-qualified owner (creator) + optional display name. */
export interface ScopeRecord {
  readonly scope: string;
  readonly ownerProvider: string;
  readonly ownerId: string;
  readonly displayName: string | null;
}

/**
 * Persistence port for scopes (the `reg_scopes` table). The race-safe claim lives here
 * because it is a storage concern: {@link claim} inserts only if absent and returns the
 * persisted record, so a loser of a concurrent claim reads back the winner's row.
 */
export interface ScopeStore {
  get(scope: string): Promise<ScopeRecord | null>;
  /** Claim `scope` for `owner` if unclaimed; return the persisted record (the winner's). */
  claim(scope: string, owner: MemberRef): Promise<ScopeRecord>;
  setDisplayName(scope: string, displayName: string | null): Promise<void>;
  /** How many scopes this identity already owns (created), for the per-user cap. */
  countOwnedBy(owner: MemberRef): Promise<number>;
}

/** Why a scope operation was refused, mapped to an HTTP status by the controller. */
export type ScopeErrorCode = "forbidden" | "not_found" | "conflict" | "too_many";

/** Tuning for {@link ScopeService}; defaults to the documented {@link REGISTRY_LIMITS}. */
export interface ScopeServiceOptions {
  /** Max scopes one identity may own (anti-squatting cap). */
  readonly maxScopesPerUser?: number;
}

export type ScopeResult<T> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly code: ScopeErrorCode; readonly message: string };

function ownedBy(record: ScopeRecord, identity: PublishIdentity): boolean {
  return record.ownerProvider === identity.provider && record.ownerId === identity.owner;
}

function refuse(
  code: ScopeErrorCode,
  message: string,
): { ok: false; code: ScopeErrorCode; message: string } {
  return { ok: false, code, message };
}

/**
 * Scope use cases (JSR-style): create/claim a scope, manage its members, set its display
 * name. Owns the authorization rules (membership gates the operations; `admin` manages)
 * and the invariants, over the {@link ScopeStore} and {@link ScopeMembers} ports - so the
 * HTTP controller only resolves the caller's identity and serializes the result. The
 * "at least one admin" invariant is enforced atomically by the members port.
 */
export class ScopeService {
  readonly #scopes: ScopeStore;
  readonly #members: ScopeMembers;
  readonly #maxScopesPerUser: number;

  constructor(scopes: ScopeStore, members: ScopeMembers, options: ScopeServiceOptions = {}) {
    this.#scopes = scopes;
    this.#members = members;
    this.#maxScopesPerUser = options.maxScopesPerUser ?? REGISTRY_LIMITS.maxScopesPerUser;
  }

  /** Create/claim a scope. The creator becomes its first admin. */
  async claim(
    identity: PublishIdentity,
    scope: string,
  ): Promise<ScopeResult<{ created: boolean; owner: MemberRef }>> {
    const owner: MemberRef = { provider: identity.provider, id: identity.owner };

    const existing = await this.#scopes.get(scope);
    if (existing !== null) {
      return ownedBy(existing, identity)
        ? { ok: true, created: false, owner }
        : refuse("conflict", `scope ${scope} is owned by ${existing.ownerId}`);
    }

    // Anti-squatting cap: refuse a NEW claim once this identity is at its scope limit.
    // Re-claiming a scope you already own (above) is exempt, so it stays idempotent.
    const owned = await this.#scopes.countOwnedBy(owner);
    if (owned >= this.#maxScopesPerUser) {
      return refuse(
        "too_many",
        `you already own ${owned} scopes (limit ${this.#maxScopesPerUser}); contact an operator to raise it`,
      );
    }

    const claimed = await this.#scopes.claim(scope, owner);
    if (!ownedBy(claimed, identity)) {
      return refuse("conflict", `scope ${scope} is owned by ${claimed.ownerId}`);
    }
    await this.#members.upsert(scope, owner, "admin");
    return { ok: true, created: true, owner };
  }

  /** List the scope's members (any member may view). */
  async listMembers(
    identity: PublishIdentity,
    scope: string,
  ): Promise<ScopeResult<{ members: ScopeMember[] }>> {
    const gate = await this.#requireMember(identity, scope);
    if (!gate.ok) return gate;
    return { ok: true, members: await this.#members.list(scope) };
  }

  /** Add a member or change their role (admin only); never demotes the last admin. */
  async setMember(
    identity: PublishIdentity,
    scope: string,
    target: MemberRef,
    role: ScopeRole,
  ): Promise<ScopeResult<{ member: ScopeMember }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;

    const current = await this.#members.roleOf(scope, target);
    if (current === "admin" && role === "member") {
      if (!(await this.#members.demoteFromAdmin(scope, target))) {
        return refuse("conflict", `scope ${scope} must keep at least one admin`);
      }
    } else {
      await this.#members.upsert(scope, target, role);
    }
    return { ok: true, member: { ...target, role } };
  }

  /** Remove a member (admin only); never removes the last admin. */
  async removeMember(
    identity: PublishIdentity,
    scope: string,
    target: MemberRef,
  ): Promise<ScopeResult<{ removed: MemberRef }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;

    const role = await this.#members.roleOf(scope, target);
    if (role === null) {
      return refuse("not_found", `${target.provider}:${target.id} is not a member of ${scope}`);
    }
    if (!(await this.#members.remove(scope, target))) {
      return refuse("conflict", `scope ${scope} must keep at least one admin`);
    }
    return { ok: true, removed: target };
  }

  /** Set the verified-publisher display name (admin only); null clears it. */
  async setDisplayName(
    identity: PublishIdentity,
    scope: string,
    displayName: string | null,
  ): Promise<ScopeResult<{ displayName: string | null }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;
    await this.#scopes.setDisplayName(scope, displayName);
    return { ok: true, displayName };
  }

  /** Caller must be a member: 404 when the scope is unknown, 403 when not a member. */
  async #requireMember(
    identity: PublishIdentity,
    scope: string,
  ): Promise<{ ok: true; role: ScopeRole } | { ok: false; code: ScopeErrorCode; message: string }> {
    const role = await this.#members.roleOf(scope, {
      provider: identity.provider,
      id: identity.owner,
    });
    if (role !== null) return { ok: true, role };
    const exists = (await this.#scopes.get(scope)) !== null;
    return exists
      ? refuse("forbidden", `you are not a member of ${scope}`)
      : refuse("not_found", `scope ${scope} does not exist`);
  }

  /** Caller must be an admin. */
  async #requireAdmin(
    identity: PublishIdentity,
    scope: string,
  ): Promise<{ ok: true; role: ScopeRole } | { ok: false; code: ScopeErrorCode; message: string }> {
    const gate = await this.#requireMember(identity, scope);
    if (!gate.ok) return gate;
    return gate.role === "admin" ? gate : refuse("forbidden", `you are not an admin of ${scope}`);
  }
}
