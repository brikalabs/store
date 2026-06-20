import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Registry tables. The store/social tables live in the store app; these are the
 * registry's source of truth for packages, immutable versions, and dist-tags.
 * Tarball bytes live in R2 keyed by the npm tarball path; only metadata is here.
 */

const epoch = sql`(unixepoch())`;

export const regPackages = sqliteTable("reg_packages", {
  name: text("name").primaryKey(),
  scope: text("scope"),
  createdAt: integer("created_at").notNull().default(epoch),
});

export const regVersions = sqliteTable(
  "reg_versions",
  {
    name: text("name")
      .notNull()
      .references(() => regPackages.name, { onDelete: "cascade" }),
    version: text("version").notNull(),
    /** The published package.json for this version. */
    manifest: text("manifest", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    /** Subresource Integrity (sha512), computed once and never changed. */
    integrity: text("integrity").notNull(),
    shasum: text("shasum").notNull(),
    size: integer("size").notNull(),
    publishedAt: integer("published_at").notNull().default(epoch),
    deprecated: text("deprecated"),
    yanked: integer("yanked", { mode: "boolean" }).notNull().default(false),
    /**
     * Operator takedown reason (abuse/policy). Null = active; non-null = removed by
     * an admin, hidden from new installs like a yank but with this public reason.
     */
    takedown: text("takedown"),
    /** CI build provenance from the GitHub OIDC token; null for local publishes. */
    provenance: text("provenance", { mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [primaryKey({ columns: [t.name, t.version] })],
);

export const regDistTags = sqliteTable(
  "reg_dist_tags",
  {
    name: text("name")
      .notNull()
      .references(() => regPackages.name, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
    version: text("version").notNull(),
  },
  (t) => [primaryKey({ columns: [t.name, t.tag] })],
);

/**
 * Organisation: the first-class ownership/account entity (ORG-001). An org owns one or
 * more npm scopes (see `reg_scopes.org_id`); membership lives on the org. The org itself
 * is provider-neutral - it is identified by its `slug` (e.g. `brika`, no `@`).
 */
export const regOrgs = sqliteTable("reg_orgs", {
  slug: text("slug").primaryKey(),
  /**
   * Display name shown as the verified publisher (e.g. "Brika Labs" for org `brika`),
   * settable only by an org admin and applied to every scope the org owns. Null falls
   * back to the slug. This is the trusted attribution: a manifest's free-text `author`
   * cannot override it.
   */
  displayName: text("display_name"),
  /** Free-text org description shown on the public org page (ORG-009). */
  description: text("description"),
  /** Arbitrary labelled external links ({ label, url }[]), admin-edited (ORG-009). */
  links: text("links", { mode: "json" }).$type<{ label: string; url: string }[]>(),
  /** Storage key of the uploaded org logo in the assets bucket; null = generated avatar. */
  iconKey: text("icon_key"),
  /**
   * Operator takedown reason (abuse/squatting/policy; ORG-007). Null = active; non-null = an
   * admin withdrew the org from public listings, with this reason recorded. Set only via the
   * operator-admin-gated registry endpoint, never by org members.
   */
  takedown: text("takedown"),
  createdAt: integer("created_at").notNull().default(epoch),
});

/**
 * Domains an org has claimed and (once its challenge TXT is found in DNS) verified, a
 * public trust badge (ORG-010). No challenge is stored: the expected TXT value is derived
 * statelessly from a server secret + org + domain (HMAC), published at
 * `_brika-challenge.<domain>`; `verified` flips once a DNS lookup confirms it (and back off
 * if a scheduled re-check no longer finds it).
 */
export const regOrgDomains = sqliteTable(
  "reg_org_domains",
  {
    orgSlug: text("org_slug")
      .notNull()
      .references(() => regOrgs.slug, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(epoch),
    verifiedAt: integer("verified_at"),
  },
  (t) => [primaryKey({ columns: [t.orgSlug, t.domain] })],
);

/**
 * Organisation membership and roles (JSR-style). An org can have several members; each is
 * a provider-qualified identity with a role: `admin` (manage members, scopes, everything
 * a member can) or `member` (publish under any scope the org owns). The org creator is
 * seeded as the first admin. Publishing is gated on org membership.
 */
export const regOrgMembers = sqliteTable(
  "reg_org_members",
  {
    orgSlug: text("org_slug")
      .notNull()
      .references(() => regOrgs.slug, { onDelete: "cascade" }),
    /** Identity provider of the member (e.g. `github`). */
    provider: text("provider").notNull().default("github"),
    /** Member id within the provider (e.g. a GitHub login or org). */
    memberId: text("member_id").notNull(),
    /** `admin` or `member`. */
    role: text("role").notNull().default("member"),
    createdAt: integer("created_at").notNull().default(epoch),
  },
  (t) => [primaryKey({ columns: [t.orgSlug, t.provider, t.memberId] })],
);

/**
 * Scope ownership (the npm-namespace string, e.g. `@brika`). A scope belongs to exactly
 * one organisation via `org_id` (1:N - an org owns many scopes; ORG-002). The scope row
 * is created when the scope is attached to an org; publishing under it is gated on
 * membership of the owning org.
 */
export const regScopes = sqliteTable("reg_scopes", {
  scope: text("scope").primaryKey(),
  /** The organisation that owns this scope. */
  orgId: text("org_id").references(() => regOrgs.slug),
  createdAt: integer("created_at").notNull().default(epoch),
});

/**
 * Trusted publishers (PUB-016): bindings that authorize a tokenless GitHub OIDC publish to
 * a scope. A binding says "this GitHub repo + workflow may publish under this scope", and an
 * OIDC publish is allowed only when its verified token claims (`repository` + `workflow_ref`)
 * match a binding (npm trusted-publisher model). Human token publishes stay org-membership-
 * gated; this is purely the CI/OIDC path. Managed by org admins of the scope's owning org.
 */
export const regTrustedPublishers = sqliteTable(
  "reg_trusted_publishers",
  {
    scope: text("scope")
      .notNull()
      .references(() => regScopes.scope, { onDelete: "cascade" }),
    /** `owner/repo` allowed to publish (matched against the OIDC `repository` claim). */
    repository: text("repository").notNull(),
    /** Workflow filename, e.g. `publish.yml` (matched against the OIDC `workflow_ref`). */
    workflow: text("workflow").notNull(),
    createdAt: integer("created_at").notNull().default(epoch),
  },
  (t) => [primaryKey({ columns: [t.scope, t.repository, t.workflow] })],
);

/**
 * Per-day tarball download counts: the install signal. One row per (package,
 * day-bucket), incremented when a tarball is served. Total installs is the sum
 * across days; "weekly" is the trailing-7-day window. Day is the unix epoch day
 * number (`unixepoch() / 86400`), so range queries are plain integer compares.
 */
export const regDownloads = sqliteTable(
  "reg_downloads",
  {
    name: text("name")
      .notNull()
      .references(() => regPackages.name, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.name, t.day] })],
);

/** Append-only audit log of publishes and ownership changes. */
export const regAudit = sqliteTable("reg_audit", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  packageName: text("package_name"),
  version: text("version"),
  actor: text("actor"),
  detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
  at: integer("at").notNull().default(epoch),
});

/** Pending OAuth device-authorization grants (RFC 8628) for `brika auth login`. */
export const regDeviceAuth = sqliteTable("reg_device_auth", {
  deviceCode: text("device_code").primaryKey(),
  userCode: text("user_code").notNull().unique(),
  /** Set when the user approves the device on store.brika.dev. */
  githubLogin: text("github_login"),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(epoch),
  expiresAt: integer("expires_at").notNull(),
});

/** Issued publish tokens (only the SHA-256 hash is stored). */
export const regTokens = sqliteTable("reg_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  /** Identity provider of the token's principal (e.g. `github`). */
  provider: text("provider").notNull().default("github"),
  /** Principal id within the provider (keeps the legacy `github_login` column name). */
  subject: text("github_login").notNull(),
  createdAt: integer("created_at").notNull().default(epoch),
  expiresAt: integer("expires_at").notNull(),
  lastUsedAt: integer("last_used_at"),
});
