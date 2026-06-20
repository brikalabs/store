import { HttpStatus } from "./http-status";
import { REGISTRY_LIMITS } from "./limits";
import type { MemberRef, ScopeMember, ScopeMembers, ScopeRole } from "./membership";
import type { OrgProfileInput } from "./profile";
import type { PublishIdentity } from "./publish";
import type {
  ClaimVerifier,
  DnsResolver,
  DomainChallenge,
  ScopeDomainRecord,
  ScopeDomains,
  ScopePublic,
  ScopeRecord,
  ScopeScopedDomain,
  ScopeStore,
} from "./scope-ports";
import type { TrustedPublisher, TrustedPublishers } from "./trusted-publishers";

// Re-export the ports so `@brika/registry-core`'s index (and any consumer) can keep
// importing them from "./scope" - the split is internal to this module.
export type {
  ClaimVerifier,
  DnsResolver,
  DomainChallenge,
  ScopeDomainRecord,
  ScopeDomains,
  ScopePublic,
  ScopeRecord,
  ScopeScopedDomain,
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

/**
 * Unconfigured challenge: returns a value that DNS can never hold, so a service with no
 * secret wired never verifies a domain (fail-closed). The real {@link DomainChallenge} is
 * injected by the composition root with the server secret.
 */
const nullDomainChallenge: DomainChallenge = { token: () => Promise.resolve(" unconfigured") };

/** No-op trusted-publisher store: no bindings, management no-ops. Real one injected by the root. */
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
 * Scope use cases (npm/JSR-style, the scope IS the ownership entity): claim a scope (creator
 * becomes first admin), manage its members + display name + profile + domains, and the
 * trusted-publisher bindings that authorize tokenless OIDC publishes. Owns the authorization
 * rules (scope membership gates the operations; `admin` manages) and the invariants, over the
 * {@link ScopeStore}, {@link ScopeMembers} and {@link ScopeDomains} ports - so the HTTP
 * controller only resolves the caller's identity and serializes the result. The "at least one
 * admin" invariant is enforced atomically by the members port.
 */
export class ScopeService {
  readonly #scopes: ScopeStore;
  readonly #members: ScopeMembers;
  readonly #domains: ScopeDomains;
  readonly #maxScopesPerAccount: number;
  readonly #verifier: ClaimVerifier;
  readonly #dns: DnsResolver;
  readonly #challenge: DomainChallenge;
  readonly #trusted: TrustedPublishers;

  constructor(
    scopes: ScopeStore,
    members: ScopeMembers,
    domains: ScopeDomains,
    options: ScopeServiceOptions = {},
  ) {
    this.#scopes = scopes;
    this.#members = members;
    this.#domains = domains;
    this.#maxScopesPerAccount = options.maxScopesPerAccount ?? REGISTRY_LIMITS.maxScopesPerAccount;
    this.#verifier = options.claimVerifier ?? allowAllClaimVerifier;
    this.#dns = options.dnsResolver ?? nullDnsResolver;
    this.#challenge = options.domainChallenge ?? nullDomainChallenge;
    this.#trusted = options.trustedPublishers ?? nullTrustedPublishers;
  }

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
    const me: MemberRef = { provider: identity.provider, id: identity.owner };

    // Identity-tied claim gate (ORG-006 seam). Allow-all by default.
    const verified = await this.#verifier.verify(identity, scope);
    if (!verified.ok) return refuse(HttpStatus.FORBIDDEN, verified.message);

    const existing = await this.#scopes.get(scope);
    if (existing !== null) return this.#reclaim(scope, me);

    // Anti-squatting cap (ORG-005): refuse a NEW claim once at the limit. Re-claiming a
    // scope you already administer (above) is exempt, so it stays idempotent.
    const owned = await this.#members.countScopesAdminedBy(me);
    if (owned >= this.#maxScopesPerAccount) {
      return refuse(
        HttpStatus.TOO_MANY_REQUESTS,
        `you already administer ${owned} scopes (limit ${this.#maxScopesPerAccount}); contact an operator to raise it`,
      );
    }

    const { created } = await this.#scopes.claim(scope);
    // Lost a race to a concurrent claimer of the same new scope: fall back to re-claim
    // semantics (idempotent if we are somehow a member, else a conflict).
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
    target: MemberRef,
    role: ScopeRole,
  ): Promise<ScopeResult<{ member: ScopeMember }>> {
    const gate = await this.#requireAdmin(identity, scope);
    if (!gate.ok) return gate;

    const current = await this.#members.roleOf(scope, target);
    if (current === "admin" && role === "member") {
      if (!(await this.#members.demoteFromAdmin(scope, target))) {
        return refuse(HttpStatus.CONFLICT, `scope ${scope} must keep at least one admin`);
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
      return refuse(
        HttpStatus.NOT_FOUND,
        `${target.provider}:${target.id} is not a member of ${scope}`,
      );
    }
    if (!(await this.#members.remove(scope, target))) {
      return refuse(HttpStatus.CONFLICT, `scope ${scope} must keep at least one admin`);
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

  /** Set the editable profile - description + links (admin only; ORG-009). */
  async setProfile(
    identity: PublishIdentity,
    scope: string,
    profile: OrgProfileInput,
  ): Promise<ScopeResult<{ profile: OrgProfileInput }>> {
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
    const record = await this.#domains.add(scope, domain);
    return { ok: true, domain: record };
  }

  /**
   * Check `_brika-challenge.<domain>` for the derived challenge TXT and mark it verified if
   * present (admin only). `verified` reflects whether the record was found; a missing record
   * or a DNS hiccup is not an error (the admin just has not published it yet) - only
   * auth/unknown-domain fail.
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
   * Re-verify every currently-verified domain (the scheduled sweep, ORG-010-AC3): re-derive
   * each challenge and look it up; REVOKE (set unverified) only when the lookup definitively
   * returns no matching record. A transport failure throws from the resolver and is caught
   * here as a SKIP, so a DNS outage never mass-revokes badges. Returns the revoked domains.
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
   * Public read (no auth): a scope's name, display name, profile (description, links, whether
   * it has an icon), and its VERIFIED domains, or null when the scope is unknown. Backs the
   * public scope page (ORG-003/009/010); never exposes membership or pending domains (only
   * verified ones are a public trust signal).
   */
  async getPublic(scope: string): Promise<ScopePublic | null> {
    const record = await this.#scopes.get(scope);
    if (record === null) return null;
    // Operator-taken-down scopes are "withdrawn from public listings" (ORG-007): the public
    // page 404s like an unknown scope, and the takedown reason is never leaked publicly.
    if (record.takedown !== null) return null;
    const domains = await this.#domains.list(scope);
    return {
      scope: record.scope,
      displayName: record.displayName,
      description: record.description,
      links: record.links,
      hasIcon: record.iconKey !== null,
      verifiedDomains: domains.filter((d) => d.verified).map((d) => d.domain),
    };
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
   * Authorize a provider's repo + workflow to publish to this scope (admin only; PUB-016).
   * Idempotent. `provider` is the OIDC provider (`github`, `gitlab`); `repository` is the
   * project (`owner/repo` / `group/project`); `workflow` is the workflow/config filename.
   * This is what lets a tokenless OIDC CI publish under the scope.
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
   * Operator takedown of a squatted/abusive scope (ORG-007): withdraw it from public listings
   * by recording `reason`. Authorization is NOT a membership check - the controller gates
   * this on the registry-operator allowlist - so this only guards that the scope exists; a
   * squatter must not be able to dodge a takedown by leaving the scope member-less.
   */
  async takedown(scope: string, reason: string): Promise<ScopeResult<{ scope: string }>> {
    return this.#setTakedown(scope, reason);
  }

  /** Operator restore: clear a takedown and return the scope to public listings (ORG-007). */
  async restore(scope: string): Promise<ScopeResult<{ scope: string }>> {
    return this.#setTakedown(scope, null);
  }

  /**
   * Every scope with its takedown state, for the operator console directory (ORG-007). No
   * membership gate - the controller restricts this to operators; the console needs to see
   * scopes it is not a member of (that is the whole point of a moderation directory).
   */
  listForOperator(): Promise<ScopeRecord[]> {
    return this.#scopes.listAll();
  }

  async #setTakedown(
    scope: string,
    reason: string | null,
  ): Promise<ScopeResult<{ scope: string }>> {
    if ((await this.#scopes.get(scope)) === null) {
      return refuse(HttpStatus.NOT_FOUND, `scope ${scope} does not exist`);
    }
    await this.#scopes.setTakedown(scope, reason);
    return { ok: true, scope };
  }

  /** Idempotent re-claim: success when the caller is already a member, else a conflict. */
  async #reclaim(
    scope: string,
    me: MemberRef,
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
    const role = await this.#members.roleOf(scope, {
      provider: identity.provider,
      id: identity.owner,
    });
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
