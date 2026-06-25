import { token } from "@brika/di";
import type { Page } from "./pagination";
import type { ScopeLink, ScopeProfileInput } from "./profile";
import type { PublishIdentity } from "./publish";

/** The ports (and records they exchange) that {@link import("./scope").ScopeService} depends on. */

/** A scope record: the scope (`@brika`), its verified-publisher display name, and editable profile. */
export interface ScopeRecord {
  readonly scope: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly links: readonly ScopeLink[];
  readonly iconKey: string | null;
  /** Operator takedown reason, or null when active (ORG-007). A taken-down scope is withdrawn from
   *  public listings, but the record and members are retained so an admin can restore it. */
  readonly takedown: string | null;
  /** Operator-granted "verified organization" badge. */
  readonly verified: boolean;
}

/**
 * Persistence port for scopes. {@link ScopeStore.claim} is race-safe: it inserts only if absent and
 * reports whether THIS call created the row, so concurrent claims serialize and exactly one caller
 * is told it created the scope (and becomes its first admin).
 */
export interface ScopeStore {
  get(scope: string): Promise<ScopeRecord | null>;
  /** Every scope, newest first - for the operator console directory (no membership filter). */
  listAll(): Promise<ScopeRecord[]>;
  /**
   * A page of scopes (newest first) for the operator directory, optionally filtered by a
   * case-insensitive substring `q` matched against the scope and its display name. The store
   * pushes the filter + window down (LIMIT/OFFSET + COUNT), so the wire never carries the
   * whole list.
   */
  listPage(opts: { q?: string; limit: number; offset: number }): Promise<Page<ScopeRecord>>;
  /** Create `scope` if unclaimed; return the persisted record and whether this call created it. */
  claim(scope: string): Promise<{ record: ScopeRecord; created: boolean }>;
  setDisplayName(scope: string, displayName: string | null): Promise<void>;
  /** Set the editable profile (description + links). */
  setProfile(scope: string, profile: ScopeProfileInput): Promise<void>;
  /** Set (or clear, with null) the uploaded icon's storage key. */
  setIcon(scope: string, iconKey: string | null): Promise<void>;
  /** Set the operator takedown reason (null restores the scope); ORG-007. */
  setTakedown(scope: string, reason: string | null): Promise<void>;
  /** Set the operator-granted "verified organization" badge. */
  setVerified(scope: string, verified: boolean): Promise<void>;
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
 * Persistence port for a scope's claimed domains. A domain is claimed, then verified once its
 * derived challenge TXT is found in DNS; verified domains are a public trust badge (ORG-010). No
 * challenge is stored - it is recomputed from a server secret via {@link DomainChallenge}.
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
 * DNS TXT lookup for domain verification (ORG-010). Returns `[]` when the lookup SUCCEEDED with no
 * matching record, and THROWS on a transport failure - so the cron can tell "TXT removed" (revoke)
 * from "DNS hiccup" (skip) apart.
 */
export interface DnsResolver {
  txt(hostname: string): Promise<string[]>;
}
/** DI token for the {@link DnsResolver} port. */
export const DnsResolver = token<DnsResolver>("DnsResolver");

/**
 * Computes the stateless domain-verification challenge: an HMAC of (server secret, scope, domain),
 * so nothing per-domain is stored and no secret can leak from the database. The scope publishes the
 * token in a TXT at `_brika-challenge.<domain>`; verification recomputes and compares.
 */
export interface DomainChallenge {
  token(scope: string, domain: string): Promise<string>;
}
/** DI token for the {@link DomainChallenge} port. */
export const DomainChallenge = token<DomainChallenge>("DomainChallenge");

/** Anti-squat seam (ORG-006): may this identity claim this scope? Defaults to allow-all until a
 *  verification system is wired in. */
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
  /** Operator-granted "verified organization" badge. */
  readonly verified: boolean;
  readonly verifiedDomains: string[];
}

/** The member view of a scope: the public view plus the operator takedown reason (hidden publicly). */
export interface ScopeManaged extends ScopePublic {
  /** Operator takedown reason, or null when active. Shown to members so they learn the scope was removed. */
  readonly takedown: string | null;
}
