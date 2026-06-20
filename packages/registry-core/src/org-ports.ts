import type { OrgLink, OrgProfileInput } from "./profile";
import type { PublishIdentity } from "./publish";

/**
 * The ports (and the records they exchange) the {@link import("./org").OrgService} depends
 * on - persistence for orgs/scopes/domains plus the injected DNS + challenge + claim seams.
 * Kept separate from the service so the dependency surface reads in one place and adapters
 * implement against types, not the service file.
 */

/**
 * An organisation record: its slug, verified-publisher display name, and editable profile
 * (description, links, uploaded icon key). The icon is stored elsewhere (R2); the record
 * only holds the key the storefront serves it by.
 */
export interface OrgRecord {
  readonly slug: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly links: readonly OrgLink[];
  readonly iconKey: string | null;
  /**
   * Operator takedown reason, or null when active (ORG-007). A taken-down org is withdrawn
   * from public listings ({@link import("./org").OrgService.getPublic} returns null) but the
   * record and its members are retained so an admin can restore it.
   */
  readonly takedown: string | null;
}

/**
 * Persistence port for organisations (the `reg_orgs` table). The race-safe claim lives
 * here because it is a storage concern: {@link OrgStore.claim} inserts only if absent and
 * reports whether THIS call created the row, so concurrent claims of a new slug serialize
 * and exactly one caller is told it created the org (and becomes its first admin).
 */
export interface OrgStore {
  get(slug: string): Promise<OrgRecord | null>;
  /** Every org, newest first - for the operator console directory (no membership filter). */
  listAll(): Promise<OrgRecord[]>;
  /** Create `slug` if unclaimed; return the persisted record and whether this call created it. */
  claim(slug: string): Promise<{ record: OrgRecord; created: boolean }>;
  setDisplayName(slug: string, displayName: string | null): Promise<void>;
  /** Set the editable profile (description + links). */
  setProfile(slug: string, profile: OrgProfileInput): Promise<void>;
  /** Set (or clear, with null) the uploaded icon's storage key. */
  setIcon(slug: string, iconKey: string | null): Promise<void>;
  /** Set the operator takedown reason (null restores the org); ORG-007. */
  setTakedown(slug: string, reason: string | null): Promise<void>;
}

/**
 * The 1:N glue between an org and the npm scopes it owns (the `reg_scopes.org_id` FK).
 * A scope belongs to exactly one org; an org owns many scopes (ORG-002).
 */
export interface OrgScopes {
  /** Every scope owned by this org (e.g. `["@acme", "@acme-labs"]`). */
  scopesForOrg(slug: string): Promise<string[]>;
  /** The org that owns this scope, or null when the scope is unattached. */
  orgForScope(scope: string): Promise<string | null>;
  /**
   * Attach `scope` to `orgSlug` if it is unattached; return the org that owns it (the
   * winner's). A scope already owned by another org is NOT moved - the caller compares
   * the returned slug to detect that conflict (ORG-002-AC3).
   */
  attach(scope: string, orgSlug: string): Promise<{ scope: string; orgSlug: string }>;
}

/** A domain an org has claimed and (once its challenge TXT is found) verified. */
export interface OrgDomainRecord {
  readonly domain: string;
  readonly verified: boolean;
}

/** An org-scoped domain, for the cron re-verification sweep across all orgs. */
export interface OrgScopedDomain {
  readonly orgSlug: string;
  readonly domain: string;
}

/**
 * Persistence port for an org's claimed domains (`reg_org_domains`). A domain is claimed,
 * then verified once its (stateless, derived) challenge TXT is found in DNS. Verified
 * domains are a public trust badge (ORG-010). No challenge is stored - it is recomputed
 * from a server secret via {@link DomainChallenge}.
 */
export interface OrgDomains {
  /** Every domain claimed by the org (verified and pending). */
  list(slug: string): Promise<OrgDomainRecord[]>;
  get(slug: string, domain: string): Promise<OrgDomainRecord | null>;
  /** Create the domain claim (unverified) if absent; return the persisted record. */
  add(slug: string, domain: string): Promise<OrgDomainRecord>;
  /** Set the verified flag (true on a successful check, false when a re-check fails). */
  setVerified(slug: string, domain: string, verified: boolean): Promise<void>;
  remove(slug: string, domain: string): Promise<boolean>;
  /** Every currently-verified domain across all orgs, for the re-verification cron. */
  listAllVerified(): Promise<OrgScopedDomain[]>;
}

/**
 * DNS TXT lookup, injected so domain verification (ORG-010) does not bake in a transport.
 * The Cloudflare adapter resolves over DNS-over-HTTPS (Workers cannot do raw DNS). It
 * returns `[]` when the lookup SUCCEEDED with no matching record, and THROWS on a transport
 * failure - so the cron can tell "TXT removed" (revoke) from "DNS hiccup" (skip) apart.
 */
export interface DnsResolver {
  txt(hostname: string): Promise<string[]>;
}

/**
 * Computes the stateless domain-verification challenge: a deterministic token derived from
 * a server secret + the org slug + the domain (HMAC), so nothing is stored and no per-domain
 * secret can leak from the database. The org publishes this token in a TXT record at
 * `_brika-challenge.<domain>`; verification recomputes and compares it. Injected so the
 * crypto + secret live in the composition root, not the domain.
 */
export interface DomainChallenge {
  token(orgSlug: string, domain: string): Promise<string>;
}

/**
 * Anti-squat seam (ORG-006): may this identity claim this name (an org slug or a scope)?
 * Injected so a provider-agnostic verification system (proving the caller controls the
 * name on GitHub, GitLab, a domain, ...) drops in without touching the claim
 * orchestration. Defaults to allow-all, so behaviour is unchanged until one is wired in.
 */
export interface ClaimVerifier {
  verify(
    identity: PublishIdentity,
    name: string,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
}

/** The public view of an org (what the unauthenticated `/org/:org` page renders). */
export interface OrgPublic {
  readonly slug: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly links: readonly OrgLink[];
  readonly iconKey: string | null;
  readonly scopes: string[];
  readonly verifiedDomains: string[];
}
