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

/** Scope ownership: a scope (e.g. `@brika`) is owned by one GitHub owner. */
export const regScopes = sqliteTable("reg_scopes", {
  scope: text("scope").primaryKey(),
  githubOwner: text("github_owner").notNull(),
  createdAt: integer("created_at").notNull().default(epoch),
});

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
  githubLogin: text("github_login").notNull(),
  createdAt: integer("created_at").notNull().default(epoch),
  expiresAt: integer("expires_at").notNull(),
  lastUsedAt: integer("last_used_at"),
});
