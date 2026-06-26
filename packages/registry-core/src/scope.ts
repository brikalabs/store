import { inject, injectOr, token } from "@brika/di";
import { HttpStatus } from "./http-status";
import { REGISTRY_LIMITS } from "./limits";
import { type ScopeMember, ScopeMembers, type ScopeRole } from "./membership";
import type { Page } from "./pagination";
import type { ScopeProfileInput } from "./profile";
import type { PublishIdentity } from "./publish";
import {
  ClaimVerifier,
  DnsResolver,
  DomainChallenge,
  type ScopeDomainRecord,
  ScopeDomains,
  type ScopeManaged,
  type ScopePublic,
  type ScopeRecord,
  type ScopeScopedDomain,
  ScopeStore,
} from "./scope-ports";
import { type TrustedPublisher, TrustedPublishers } from "./trusted-publishers";

/** Max scopes one account may administer (anti-squat cap, ORG-005); optional, defaults to limits. */
export const MaxScopesPerAccount = token<number>("MaxScopesPerAccount");

export {
  ClaimVerifier,
  DnsResolver,
  DomainChallenge,
  type ScopeDomainRecord,
  ScopeDomains,
  type ScopeManaged,
  type ScopePublic,
  type ScopeRecord,
  type ScopeScopedDomain,
  ScopeStore,
} from "./scope-ports";

/** Tuning for {@link ScopeService}; defaults to the documented {@link REGISTRY_LIMITS}. */
export interface ScopeServiceOptions {
  /** Max scopes one account may administer (anti-squatting cap, ORG-005). */
  readonly maxScopesPerAccount?: number;
  /** Identity-tied claim gate (ORG-006); defaults to allow-all. */
  readonly claimVerifier?: ClaimVerifier;
  /** DNS TXT resolver for domain verification (ORG-010); defaults to a no-op (never verifies). */
  readonly dnsResolver?: DnsResolver;
  /** Stateless challenge derivation (HMAC); defaults to one that never matches (unconfigured). */
  readonly domainChallenge?: DomainChallenge;
  /** Trusted-publisher store (PUB-016); defaults to a no-op (no bindings, management no-ops). */
  readonly trustedPublishers?: TrustedPublishers;
}

export type ScopeResult<T> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly status: number; readonly message: string };

/** Allow-all verifier: the default until a real {@link ClaimVerifier} is wired in. */
const allowAllClaimVerifier: ClaimVerifier = { verify: () => Promise.resolve({ ok: true }) };

/** No-op resolver: returns no TXT records, so a domain stays unverified until a real one is wired. */
const nullDnsResolver: DnsResolver = { txt: () => Promise.resolve([]) };

/** Unconfigured challenge: returns a value DNS can never hold, so a service with no secret wired
 *  never verifies a domain (fail-closed). */
const nullDomainChallenge: DomainChallenge = { token: () => Promise.resolve(" unconfigured") };

/** No-op trusted-publisher store: no bindings, management no-ops. */
const nullTrustedPublishers: TrustedPublishers = {
  listForScope: () => Promise.resolve([]),
  add: (binding) => Promise.resolve(binding),
  remove: () => Promise.resolve(false),
};

/** The DNS name a scope must publish its challenge TXT at (a dedicated subdomain). */
export function domainChallengeHost(domain: string): string {
  return `_brika-challenge.${domain}`;
}

function refuse(status: number, message: string): { ok: false; status: number; message: string } {
  return { ok: false, status, message };
}

/**
 * Scope use cases (the scope IS the ownership entity): claim a scope (creator becomes first admin),
 * manage its members/display name/profile/domains, and the trusted-publisher bindings that authorize
 * tokenless OIDC publishes. Owns the authorization rules (membership gates operations; `admin`
 * manages); the "at least one admin" invariant is enforced atomically by the members port.
 */
export class ScopeService {
  readonly #scopes = inject(ScopeStore);
  readonly #members = inject(ScopeMembers);
  readonly #domains = inject(ScopeDomains);
  readonly #maxScopesPerAccount = injectOr(
    MaxScopesPerAccount,
    REGISTRY_LIMITS.maxScopesPerAccount,
  );
  readonly #verifier = injectOr(ClaimVerifier, allowAllClaimVerifier);
  readonly #dns = injectOr(DnsResolver, nullDnsResolver);
  readonly #challenge = injectOr(DomainChallenge, nullDomainChallenge);
  readonly #trusted = injectOr(TrustedPublishers, nullTrustedPublishers);

  /** The challenge TXT value a scope must publish at {@link domainChallengeHost} (ORG-010). */
  domainChallenge(scope: string, domain: string): Promise<string> {
    return this.#challenge.token(scope, domain);
  }

  /** Look up the challenge TXT, treating a transport failure as "no records found". */
  async #txtSafe(host: string): Promise<string[]> {
    try {
      return await this.#dns.txt(host);
    } catch {
      return [];
    }
  }

  /** Create/claim a scope. The creator becomes its first admin. */
  async claim(
    identity: PublishIdentity,
    scope: string,
  ): Promise<ScopeResult<{ created: boolean; scope: string }>> {
    const me = identity.userId;
    if (me === null) return refuse(HttpStatus.FORBIDDEN, "a CI credential cannot claim a scope");

    // Identity-tied claim gate (ORG-006).
    const verified = await this.#verifier.verify(identity, scope);
    if (!verified.ok) return refuse(HttpStatus.FORBIDDEN, verified.message);

    const existing = await this.#scopes.get(scope);
    if (existing !== null) return this.#reclaim(scope, me);

    // Anti-squatting cap (ORG-005): refuse a NEW claim once at the limit. Re-claiming a scope you
    // already administer (handled above) is exempt, so it stays idempotent.
    const owned = await this.#members.countScopesAdminedBy(me);
    if (owned >= this.#maxScopesPerAccount) {
      return refuse(
        HttpStatus.TOO_MANY_REQUESTS,
        `you already administer ${owned} scopes (limit ${this.#maxScopesPerAccount}); contact an operator to raise it`,
      );
    }

    const { created } = await this.#scopes.claim(scope);
    // Lost a race to a concurrent claimer: fall back to re-claim semantics (idempotent if we are
    // somehow a member, else a conflict).
    if (!created) return this.#reclaim(scope, me);
    await this.#members.upsert(scope, me, "admin");
    return { ok: true, created: true, scope };
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
    targetUserId: string,
    role: ScopeRole,
  ): Promise<ScopeResult<{ member: ScopeMember }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;

    const current = await this.#members.roleOf(scope, targetUserId);
    if (current === "admin" && role === "member") {
      if (!(await this.#members.demoteFromAdmin(scope, targetUserId))) {
        return refuse(HttpStatus.CONFLICT, `scope ${scope} must keep at least one admin`);
      }
    } else {
      await this.#members.upsert(scope, targetUserId, role);
    }
    return { ok: true, member: { userId: targetUserId, role } };
  }

  /** Remove a member (admin only); never removes the last admin. */
  async removeMember(
    identity: PublishIdentity,
    scope: string,
    targetUserId: string,
  ): Promise<ScopeResult<{ removed: string }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;

    const role = await this.#members.roleOf(scope, targetUserId);
    if (role === null) {
      return refuse(HttpStatus.NOT_FOUND, `${targetUserId} is not a member of ${scope}`);
    }
    if (!(await this.#members.remove(scope, targetUserId))) {
      return refuse(HttpStatus.CONFLICT, `scope ${scope} must keep at least one admin`);
    }
    return { ok: true, removed: targetUserId };
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

  /** Set the editable profile - description + links (admin only; ORG-009). */
  async setProfile(
    identity: PublishIdentity,
    scope: string,
    profile: ScopeProfileInput,
  ): Promise<ScopeResult<{ profile: ScopeProfileInput }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;
    await this.#scopes.setProfile(scope, profile);
    return { ok: true, profile };
  }

  /**
   * Record (or clear, with null) the uploaded icon's storage key (admin only; ORG-009).
   * The bytes are written to object storage by the caller; this only persists the key.
   */
  async setIcon(
    identity: PublishIdentity,
    scope: string,
    iconKey: string | null,
  ): Promise<ScopeResult<{ iconKey: string | null }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;
    await this.#scopes.setIcon(scope, iconKey);
    return { ok: true, iconKey };
  }

  /** List the scope's claimed domains, verified + pending (any member may view; ORG-010). */
  async listDomains(
    identity: PublishIdentity,
    scope: string,
  ): Promise<ScopeResult<{ domains: ScopeDomainRecord[] }>> {
    const gate = await this.#requireMember(identity, scope);
    if (!gate.ok) return gate;
    return { ok: true, domains: await this.#domains.list(scope) };
  }

  /** Claim a domain for the scope (admin only; ORG-010). The challenge TXT is derived, not stored. */
  async addDomain(
    identity: PublishIdentity,
    scope: string,
    domain: string,
  ): Promise<ScopeResult<{ domain: ScopeDomainRecord }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;
    const existing = await this.#domains.get(scope, domain);
    if (existing !== null) return { ok: true, domain: existing };
    return { ok: true, domain: await this.#domains.add(scope, domain) };
  }

  /**
   * Check `_brika-challenge.<domain>` for the derived challenge TXT and mark it verified if present
   * (admin only). A missing record or DNS hiccup is not an error (the admin just has not published
   * it yet) - only auth/unknown-domain fail.
   */
  async verifyDomain(
    identity: PublishIdentity,
    scope: string,
    domain: string,
  ): Promise<ScopeResult<{ domain: string; verified: boolean }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;
    const record = await this.#domains.get(scope, domain);
    if (record === null) return refuse(HttpStatus.NOT_FOUND, `${scope} has not claimed ${domain}`);
    if (record.verified) return { ok: true, domain, verified: true };

    const want = await this.#challenge.token(scope, domain);
    const records = await this.#txtSafe(domainChallengeHost(domain));
    const verified = records.some((value) => value.trim() === want);
    if (verified) await this.#domains.setVerified(scope, domain, true);
    return { ok: true, domain, verified };
  }

  /**
   * Re-verify every currently-verified domain (the scheduled sweep, ORG-010-AC3): REVOKE only when
   * the lookup definitively returns no matching record. A transport failure is caught as a SKIP, so
   * a DNS outage never mass-revokes badges.
   */
  async reverifyDomains(): Promise<ScopeScopedDomain[]> {
    const revoked: ScopeScopedDomain[] = [];
    for (const { scope, domain } of await this.#domains.listAllVerified()) {
      let records: string[];
      try {
        records = await this.#dns.txt(domainChallengeHost(domain));
      } catch {
        continue; // transport failure - skip, do not revoke on a transient error
      }
      const want = await this.#challenge.token(scope, domain);
      if (!records.some((value) => value.trim() === want)) {
        await this.#domains.setVerified(scope, domain, false);
        revoked.push({ scope, domain });
      }
    }
    return revoked;
  }

  /** Remove a claimed domain (admin only); 404 when the scope never claimed it (ORG-010). */
  async removeDomain(
    identity: PublishIdentity,
    scope: string,
    domain: string,
  ): Promise<ScopeResult<{ removed: string }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;
    if (!(await this.#domains.remove(scope, domain))) {
      return refuse(HttpStatus.NOT_FOUND, `${scope} has not claimed ${domain}`);
    }
    return { ok: true, removed: domain };
  }

  /** The icon storage key for a scope, or null when it has none (cheap single-row read). */
  async iconKeyOf(scope: string): Promise<string | null> {
    return (await this.#scopes.get(scope))?.iconKey ?? null;
  }

  /**
   * Public read (no auth): a scope's name, display name, profile, and VERIFIED domains, or null when
   * unknown. Never exposes membership or pending domains (only verified ones are a public trust
   * signal). ORG-003/009/010.
   */
  async getPublic(scope: string): Promise<ScopePublic | null> {
    const record = await this.#scopes.get(scope);
    // Taken-down scopes are withdrawn from public listings (ORG-007): 404 like an unknown scope, and
    // the takedown reason is never leaked publicly. (`record?.takedown` is undefined when unknown.)
    if (record?.takedown !== null) return null;
    return this.#publicView(record, await this.#domains.list(scope));
  }

  /**
   * Member read: the same view as {@link getPublic} PLUS the operator takedown reason, which the
   * public view hides. So a scope's own members still load their settings page when an operator has
   * taken the scope down, and see WHY (the banner). 403/404 for a non-member/unknown scope.
   */
  async getManaged(
    identity: PublishIdentity,
    scope: string,
  ): Promise<ScopeResult<{ managed: ScopeManaged }>> {
    const gate = await this.#requireMember(identity, scope);
    if (!gate.ok) return gate;
    const record = await this.#scopes.get(scope);
    if (record === null) return refuse(HttpStatus.NOT_FOUND, `scope ${scope} does not exist`);
    const view = this.#publicView(record, await this.#domains.list(scope));
    return { ok: true, managed: { ...view, takedown: record.takedown } };
  }

  /** Shape a stored record into the public view (shared by {@link getPublic} and {@link getManaged}). */
  #publicView(record: ScopeRecord, domains: readonly ScopeDomainRecord[]): ScopePublic {
    return {
      scope: record.scope,
      displayName: record.displayName,
      description: record.description,
      links: record.links,
      hasIcon: record.iconKey !== null,
      verified: record.verified,
      verifiedDomains: domains.filter((d) => d.verified).map((d) => d.domain),
    };
  }

  /**
   * Operator toggle of a scope's "verified organization" badge (manual moderation). NOT
   * ownership-gated (an admin grants trust); the caller must already be an authorized operator.
   * 404 when the scope does not exist.
   */
  async setVerified(scope: string, verified: boolean): Promise<ScopeResult<{ verified: boolean }>> {
    const missing = await this.#requireScope(scope);
    if (missing !== null) return missing;
    await this.#scopes.setVerified(scope, verified);
    return { ok: true, verified };
  }

  /** List the trusted-publisher bindings for this scope (admin only; PUB-016). */
  async listTrustedPublishers(
    identity: PublishIdentity,
    scope: string,
  ): Promise<ScopeResult<{ publishers: TrustedPublisher[] }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;
    return { ok: true, publishers: await this.#trusted.listForScope(scope) };
  }

  /**
   * Authorize a provider's repo + workflow to publish to this scope, letting a tokenless OIDC CI
   * publish under it (admin only; PUB-016). Idempotent.
   */
  async addTrustedPublisher(
    identity: PublishIdentity,
    scope: string,
    binding: { provider: string; repository: string; workflow: string },
  ): Promise<ScopeResult<{ publisher: TrustedPublisher }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;
    const publisher = await this.#trusted.add({ scope, ...binding });
    return { ok: true, publisher };
  }

  /** Remove a trusted-publisher binding (admin only; PUB-016). 404 when no such binding. */
  async removeTrustedPublisher(
    identity: PublishIdentity,
    scope: string,
    binding: { provider: string; repository: string; workflow: string },
  ): Promise<ScopeResult<{ removed: TrustedPublisher }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;
    const { provider, repository, workflow } = binding;
    if (!(await this.#trusted.remove(scope, provider, repository, workflow))) {
      return refuse(
        HttpStatus.NOT_FOUND,
        `${provider}:${repository} (${workflow}) is not a trusted publisher of ${scope}`,
      );
    }
    return { ok: true, removed: { scope, provider, repository, workflow } };
  }

  /**
   * Operator takedown of a squatted/abusive scope (ORG-007). NOT a membership check (the controller
   * gates on the operator allowlist) - this only guards that the scope exists, so a squatter cannot
   * dodge a takedown by leaving the scope member-less.
   */
  async takedown(scope: string, reason: string): Promise<ScopeResult<{ scope: string }>> {
    return this.#setTakedown(scope, reason);
  }

  /** Operator restore: clear a takedown and return the scope to public listings (ORG-007). */
  async restore(scope: string): Promise<ScopeResult<{ scope: string }>> {
    return this.#setTakedown(scope, null);
  }

  /**
   * A page of scopes with their takedown state, for the operator console directory (ORG-007),
   * optionally filtered by `q` (a substring over the scope + display name). No membership gate -
   * the controller restricts this to operators; the console needs to see scopes it is not a
   * member of (that is the whole point of a moderation directory). The store pushes the filter +
   * window down, so the wire never carries the whole list.
   */
  listForOperator(opts: { q?: string; limit: number; offset: number }): Promise<Page<ScopeRecord>> {
    return this.#scopes.listPage(opts);
  }

  async #setTakedown(
    scope: string,
    reason: string | null,
  ): Promise<ScopeResult<{ scope: string }>> {
    const missing = await this.#requireScope(scope);
    if (missing !== null) return missing;
    await this.#scopes.setTakedown(scope, reason);
    return { ok: true, scope };
  }

  /** 404 result when the scope does not exist, else null. */
  async #requireScope(
    scope: string,
  ): Promise<{ ok: false; status: number; message: string } | null> {
    if ((await this.#scopes.get(scope)) !== null) return null;
    return refuse(HttpStatus.NOT_FOUND, `scope ${scope} does not exist`);
  }

  /** Idempotent re-claim: success when the caller is already a member, else a conflict. */
  async #reclaim(
    scope: string,
    me: string,
  ): Promise<ScopeResult<{ created: boolean; scope: string }>> {
    const role = await this.#members.roleOf(scope, me);
    return role === null
      ? refuse(HttpStatus.CONFLICT, `scope ${scope} is already claimed`)
      : { ok: true, created: false, scope };
  }

  /** Caller must be a member: 404 when the scope is unknown, 403 when not a member. */
  async #requireMember(
    identity: PublishIdentity,
    scope: string,
  ): Promise<{ ok: true; role: ScopeRole } | { ok: false; status: number; message: string }> {
    const role =
      identity.userId === null ? null : await this.#members.roleOf(scope, identity.userId);
    if (role !== null) return { ok: true, role };
    const exists = (await this.#scopes.get(scope)) !== null;
    return exists
      ? refuse(HttpStatus.FORBIDDEN, `you are not a member of ${scope}`)
      : refuse(HttpStatus.NOT_FOUND, `scope ${scope} does not exist`);
  }

  /** Caller must be an admin. */
  async #requireAdmin(
    identity: PublishIdentity,
    scope: string,
  ): Promise<{ ok: true; role: ScopeRole } | { ok: false; status: number; message: string }> {
    const gate = await this.#requireMember(identity, scope);
    if (!gate.ok) return gate;
    return gate.role === "admin"
      ? gate
      : refuse(HttpStatus.FORBIDDEN, `you are not an admin of ${scope}`);
  }
}
