import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * The relational mirror of npm plus the social layer. npm stays the source of
 * truth for code; these tables are a cache (plugins, versions) and the data the
 * store owns (users, user profiles, reviews, comments, votes, reports).
 */

const epoch = sql`(unixepoch())`;

export const plugins = sqliteTable(
  "plugins",
  {
    name: text("name").primaryKey(),
    scope: text("scope"),
    displayName: text("display_name"),
    description: text("description"),
    latestVersion: text("latest_version").notNull(),
    repository: text("repository"),
    homepage: text("homepage"),
    license: text("license"),
    keywords: text("keywords", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    authorId: text("author_id"),
    downloadsWeekly: integer("downloads_weekly").notNull().default(0),
    brikaEngine: text("brika_engine").notNull(),
    capabilities: text("capabilities", { mode: "json" }).$type<{
      tools: number;
      blocks: number;
      bricks: number;
      sparks: number;
      pages: number;
    }>(),
    grants: text("grants", { mode: "json" }).$type<Record<string, unknown>>(),
    iconR2Key: text("icon_r2_key"),
    readmeR2Key: text("readme_r2_key"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    ratingAverage: real("rating_average").notNull().default(0),
    ratingCount: integer("rating_count").notNull().default(0),
    firstPublishedAt: integer("first_published_at"),
    lastSyncedAt: integer("last_synced_at").notNull().default(epoch),
  },
  (t) => [
    index("idx_plugins_downloads").on(t.downloadsWeekly),
    index("idx_plugins_author").on(t.authorId),
  ],
);

export const pluginVersions = sqliteTable(
  "plugin_versions",
  {
    pluginName: text("plugin_name")
      .notNull()
      .references(() => plugins.name, { onDelete: "cascade" }),
    version: text("version").notNull(),
    publishedAt: integer("published_at"),
    brikaEngine: text("brika_engine"),
    changelog: text("changelog"),
    deprecated: text("deprecated"),
  },
  (t) => [primaryKey({ columns: [t.pluginName, t.version] })],
);

/**
 * The first-class Brika account (USER-001). Backs BetterAuth's `user` model via
 * `modelName: "users"`, so the SQL table keeps the name `users` and `users.id`
 * stays the PK that reviews/comments/votes/reports reference. Property keys here
 * are the BetterAuth field names (camelCase); the SQL column names stay snake_case.
 *
 * The account id is the ONLY identity: there is no GitHub-login column - scope
 * ownership, the operator allowlist, tokens and the audit log are all keyed on
 * `users.id`. Provider ids live in the BetterAuth `account` table.
 *
 * The user-authored profile fields (USER-003/005) live here too rather than in a
 * separate 1:1 `user_profiles` table: `displayName` overrides the provider `name`,
 * `links` is a labelled list, and `avatarVersion` is the content tag of an uploaded
 * avatar in R2 (its public URL is BUILT from `ASSETS_PUBLIC_URL` + this, never stored;
 * null falls back to the provider `image`). BetterAuth only syncs `name`/`image` from
 * the provider, so a re-sign-in never clobbers these author-owned fields.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  displayName: text("display_name"),
  bio: text("bio"),
  website: text("website"),
  avatarVersion: text("avatar_version"),
  links: text("links", { mode: "json" })
    .$type<{ label: string; url: string }[]>()
    .notNull()
    .default(sql`'[]'`),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(epoch),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(epoch),
});

/** BetterAuth `session` model: DB-backed sessions in D1 (AUTH-012). */
export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(epoch),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(epoch),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

/** BetterAuth `account` model: linked provider identities referencing a user (USER-001/AUTH-011). */
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(epoch),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(epoch),
});

/** BetterAuth `verification` model: short-lived verification tokens. */
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(epoch),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(epoch),
});

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    pluginName: text("plugin_name")
      .notNull()
      .references(() => plugins.name, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    versionReviewed: text("version_reviewed"),
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: integer("created_at").notNull().default(epoch),
    updatedAt: integer("updated_at").notNull().default(epoch),
    edited: integer("edited", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    index("idx_reviews_plugin").on(t.pluginName),
    // one review per user per plugin (editable)
    uniqueIndex("uniq_review_user_plugin").on(t.userId, t.pluginName),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    pluginName: text("plugin_name")
      .notNull()
      .references(() => plugins.name, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull().default(epoch),
    edited: integer("edited", { mode: "boolean" }).notNull().default(false),
    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("idx_comments_plugin").on(t.pluginName)],
);

export const reviewVotes = sqliteTable(
  "review_votes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.reviewId] })],
);

/** One upvote per user per comment (the comment "grade"). */
export const commentVotes = sqliteTable(
  "comment_votes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] })],
);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  reporterUserId: text("reporter_user_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at").notNull().default(epoch),
});
