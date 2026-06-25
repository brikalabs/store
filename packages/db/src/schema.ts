import type { Actor } from "@brika/registry-core";
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Registry tables: the source of truth for packages, immutable versions, and dist-tags (store/social
 * tables live in the store app). Tarball bytes live in R2 keyed by the npm tarball path; only metadata is here.
 */

const epoch = sql`(unixepoch())`;

export const regPackages = sqliteTable("reg_packages", {
  name: text("name").primaryKey(),
  scope: text("scope"),
  createdAt: integer("created_at").notNull().default(epoch),
  /** Operator-set "approved by Brika" trust badge (manual moderation, not domain proof). */
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
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
 * Scope: the first-class ownership/account entity. The npm namespace (e.g. `@brika`) AND the group
 * that owns it - there is no separate org layer (the npm/JSR model: the scope *is* the account).
 */
export const regScopes = sqliteTable("reg_scopes", {
  scope: text("scope").primaryKey(),
  /**
   * Verified-publisher display name, settable only by a scope admin (null falls back to the scope).
   * The trusted attribution: a manifest's free-text `author` cannot override it.
   */
  displayName: text("display_name"),
  /** Free-text description shown on the public scope page. */
  description: text("description"),
  /** Arbitrary labelled external links ({ label, url }[]), admin-edited. */
  links: text("links", { mode: "json" }).$type<{ label: string; url: string }[]>(),
  /** Storage key of the uploaded scope logo in the assets bucket; null = generated avatar. */
  iconKey: text("icon_key"),
  /**
   * Operator takedown reason. Null = active; non-null withdraws the scope from public listings.
   * Set only via the operator-admin-gated endpoint, never by scope members.
   */
  takedown: text("takedown"),
  createdAt: integer("created_at").notNull().default(epoch),
});

/**
 * Scope membership and roles: `admin` (manage members + everything a member can) or `member`
 * (publish under the scope). The creator is seeded as the first admin; publishing is member-gated.
 */
export const regScopeMembers = sqliteTable(
  "reg_scope_members",
  {
    scope: text("scope")
      .notNull()
      .references(() => regScopes.scope, { onDelete: "cascade" }),
    /** Brika account id of the member. */
    userId: text("user_id").notNull(),
    /** `admin` or `member`. */
    role: text("role").notNull().default("member"),
    createdAt: integer("created_at").notNull().default(epoch),
  },
  (t) => [primaryKey({ columns: [t.scope, t.userId] })],
);

/**
 * Domains a scope has claimed and (once its challenge TXT is found at `_brika-challenge.<domain>`)
 * verified, a public trust badge. No challenge is stored: the expected TXT is derived statelessly
 * from a server secret + scope + domain (HMAC). `verified` flips off if a re-check no longer finds it.
 */
export const regScopeDomains = sqliteTable(
  "reg_scope_domains",
  {
    scope: text("scope")
      .notNull()
      .references(() => regScopes.scope, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(epoch),
    verifiedAt: integer("verified_at"),
  },
  (t) => [primaryKey({ columns: [t.scope, t.domain] })],
);

/**
 * Trusted publishers (PUB-016): bindings authorizing a tokenless OIDC publish to a scope. An OIDC
 * publish is allowed only when its verified token claims (`repository` + `workflow_ref`) match a
 * binding (npm model). Human token publishes stay membership-gated; this is purely the CI/OIDC path.
 */
export const regTrustedPublishers = sqliteTable(
  "reg_trusted_publishers",
  {
    scope: text("scope")
      .notNull()
      .references(() => regScopes.scope, { onDelete: "cascade" }),
    /** OIDC provider the binding trusts: `github`, `gitlab`, ... (matched against the issuer). */
    provider: text("provider").notNull().default("github"),
    /** The project the token must come from: GitHub `owner/repo`, GitLab `group/project`. */
    repository: text("repository").notNull(),
    /** Workflow/config filename, e.g. `publish.yml` / `.gitlab-ci.yml` (from the OIDC ref claim). */
    workflow: text("workflow").notNull(),
    createdAt: integer("created_at").notNull().default(epoch),
  },
  (t) => [primaryKey({ columns: [t.scope, t.provider, t.repository, t.workflow] })],
);

/**
 * Per-day tarball download counts (the install signal), one row per (package, day-bucket). Day is
 * the unix epoch day number (`unixepoch() / 86400`), so range queries are plain integer compares.
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

/**
 * Denormalized search projection: one row per package mirroring its latest installable version.
 * Exists only to push search filtering/sorting/pagination into SQL - the `reg_versions.manifest`
 * stays the source of truth (and is what the endpoint returns). Maintained by the publish/yank/
 * takedown path ({@link D1MetadataWriter}) and backfilled by the migration; never hand-edited.
 *
 * An external-content FTS5 table (`reg_search_fts`) over `display_name`/`description`/`keywords`/
 * `name` and its sync triggers are created in the migration (outside Drizzle's schema model), so
 * full-text search and `bm25()` ranking run against this row's text.
 */
export const regSearch = sqliteTable("reg_search", {
  name: text("name")
    .primaryKey()
    .references(() => regPackages.name, { onDelete: "cascade" }),
  /** The latest installable version this row projects (joins back to `reg_versions`). */
  version: text("version").notNull(),
  /** Manifest `displayName`; also the `name` sort key (falls back to `name`). */
  displayName: text("display_name"),
  /** Manifest `description` (FTS only). */
  description: text("description"),
  /** Space-joined manifest keywords, for the FTS `keywords` column (exact-tag filtering uses {@link regKeywords}). */
  keywords: text("keywords").notNull().default(""),
  tools: integer("tools").notNull().default(0),
  blocks: integer("blocks").notNull().default(0),
  bricks: integer("bricks").notNull().default(0),
  sparks: integer("sparks").notNull().default(0),
  pages: integer("pages").notNull().default(0),
  /** Unix-seconds publish time of the projected version, for the `recent` sort. */
  publishedAt: integer("published_at").notNull().default(epoch),
});

/** One row per (package, keyword) of the latest version: the indexed facet for exact tag filtering. */
export const regKeywords = sqliteTable(
  "reg_keywords",
  {
    name: text("name")
      .notNull()
      .references(() => regPackages.name, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.name, t.keyword] }),
    index("reg_keywords_keyword_idx").on(t.keyword),
  ],
);

/** Append-only audit log of publishes and ownership changes. */
export const regAudit = sqliteTable("reg_audit", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  packageName: text("package_name"),
  version: text("version"),
  /** The acting principal, snapshotted at write time (account id + display name + avatar). */
  actor: text("actor", { mode: "json" }).$type<Actor>(),
  detail: text("detail", { mode: "json" }).$type<Record<string, unknown>>(),
  at: integer("at").notNull().default(epoch),
});

/** Pending OAuth device-authorization grants (RFC 8628) for `brika auth login`. */
export const regDeviceAuth = sqliteTable("reg_device_auth", {
  deviceCode: text("device_code").primaryKey(),
  userCode: text("user_code").notNull().unique(),
  /** Brika account id set when the user approves the device on store.brika.dev. */
  userId: text("user_id"),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(epoch),
  expiresAt: integer("expires_at").notNull(),
});

/** Issued publish tokens (only the SHA-256 hash is stored). */
export const regTokens = sqliteTable("reg_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  /** Brika account id the token was issued to. */
  userId: text("user_id").notNull(),
  createdAt: integer("created_at").notNull().default(epoch),
  expiresAt: integer("expires_at").notNull(),
  lastUsedAt: integer("last_used_at"),
});
