import { token } from "@brika/di";
import type { ScopeLink, ScopeProfileInput } from "./profile";
import type { PublishIdentity } from "./publish";

/**
 * The ports (and the records they exchange) the {@link import("./scope").ScopeService}
 * depends on - persistence for scopes/domains plus the injected DNS + challenge + claim
 * seams. Kept separate from the service so the dependency surface reads in one place and
 * adapters implement against types, not the service file.
 */

/**
 * A scope record: the scope (`@brika`), its verified-publisher display name, and editable
 * profile (description, links, uploaded icon key). The icon is stored elsewhere (R2); the
 * record only holds the key the storefront serves it by.
 */
export interface ScopeRecord {
  readonly scope: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly links: readonly ScopeLink[];
  readonly iconKey: string | null;
  /**
   * Operator takedown reason, or null when active (ORG-007). A taken-down scope is withdrawn
   * from public listings ({@link import("./scope").ScopeService.getPublic} returns null) but
   * the record and its members are retained so an admin can restore it.
   */
  readonly takedown: string | null;
}

/**
 * Persistence port for scopes (the `reg_scopes` table). The race-safe claim lives here
 * because it is a storage concern: {@link ScopeStore.claim} inserts only if absent and
 * reports whether THIS call created the row, so concurrent claims of a new scope serialize
 * and exactly one caller is told it created the scope (and becomes its first admin).
 */
export interface ScopeStore {
  get(scope: string): Promise<ScopeRecord | null>;
  /** Every scope, newest first - for the operator console directory (no membership filter). */
  listAll(): Promise<ScopeRecord[]>;
  /** Create `scope` if unclaimed; return the persisted record and whether this call created it. */
  claim(scope: string): Promise<{ record: ScopeRecord; created: boolean }>;
  setDisplayName(scope: string, displayName: string | null): Promise<void>;
  /** Set the editable profile (description + links). */
  setProfile(scope: string, profile: ScopeProfileInput): Promise<void>;
  /** Set (or clear, with null) the uploaded icon's storage key. */
  setIcon(scope: string, iconKey: string | null): Promise<void>;
  /** Set the operator takedown reason (null restores the scope); ORG-007. */
  setTakedown(scope: string, reason: string | null): Promise<void>;
}
/** DI token for the {@link ScopeStore} port. */
export const ScopeStore = token<ScopeStore>("ScopeStore");

/** A domain a scope has claimed and (once its challenge TXT is found) verified. */
export interface ScopeDomainRecord {
  readonly domain: string;
  readonly verified: boolean;
}

/** A scope-qualified domain, for the cron re-verification sweep across all scopes. */
export interface ScopeScopedDomain {
  readonly scope: string;
  readonly domain: string;
}

/**
 * Persistence port for a scope's claimed domains (`reg_scope_domains`). A domain is claimed,
 * then verified once its (stateless, derived) challenge TXT is found in DNS. Verified
 * domains are a public trust badge (ORG-010). No challenge is stored - it is recomputed
 * from a server secret via {@link DomainChallenge}.
 */
export interface ScopeDomains {
  /** Every domain claimed by the scope (verified and pending). */
  list(scope: string): Promise<ScopeDomainRecord[]>;
  get(scope: string, domain: string): Promise<ScopeDomainRecord | null>;
  /** Create the domain claim (unverified) if absent; return the persisted record. */
  add(scope: string, domain: string): Promise<ScopeDomainRecord>;
  /** Set the verified flag (true on a successful check, false when a re-check fails). */
  setVerified(scope: string, domain: string, verified: boolean): Promise<void>;
  remove(scope: string, domain: string): Promise<boolean>;
  /** Every currently-verified domain across all scopes, for the re-verification cron. */
  listAllVerified(): Promise<ScopeScopedDomain[]>;
}
/** DI token for the {@link ScopeDomains} port. */
export const ScopeDomains = token<ScopeDomains>("ScopeDomains");

/**
 * DNS TXT lookup, injected so domain verification (ORG-010) does not bake in a transport.
 * The Cloudflare adapter resolves over DNS-over-HTTPS (Workers cannot do raw DNS). It
 * returns `[]` when the lookup SUCCEEDED with no matching record, and THROWS on a transport
 * failure - so the cron can tell "TXT removed" (revoke) from "DNS hiccup" (skip) apart.
 */
export interface DnsResolver {
  txt(hostname: string): Promise<string[]>;
}
/** DI token for the {@link DnsResolver} port. */
export const DnsResolver = token<DnsResolver>("DnsResolver");

/**
 * Computes the stateless domain-verification challenge: a deterministic token derived from
 * a server secret + the scope + the domain (HMAC), so nothing is stored and no per-domain
 * secret can leak from the database. The scope publishes this token in a TXT record at
 * `_brika-challenge.<domain>`; verification recomputes and compares it. Injected so the
 * crypto + secret live in the composition root, not the domain.
 */
export interface DomainChallenge {
  token(scope: string, domain: string): Promise<string>;
}
/** DI token for the {@link DomainChallenge} port. */
export const DomainChallenge = token<DomainChallenge>("DomainChallenge");

/**
 * Anti-squat seam (ORG-006): may this identity claim this scope (`@name`)? Injected so a
 * provider-agnostic verification system (proving the caller controls the name on GitHub,
 * GitLab, a domain, ...) drops in without touching the claim orchestration. Defaults to
 * allow-all, so behaviour is unchanged until one is wired in.
 */
export interface ClaimVerifier {
  verify(
    identity: PublishIdentity,
    name: string,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
}
/** DI token for the {@link ClaimVerifier} port (optional; defaults to allow-all in {@link import("./scope").ScopeService}). */
export const ClaimVerifier = token<ClaimVerifier>("ClaimVerifier");

/** The public view of a scope (what the unauthenticated `/@:scope` page renders). */
export interface ScopePublic {
  readonly scope: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly links: readonly ScopeLink[];
  /** Whether the scope has an uploaded icon (the storage key itself is not public). */
  readonly hasIcon: boolean;
  readonly verifiedDomains: string[];
}
