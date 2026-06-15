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
 * truth for code; these tables are a cache (plugins, versions, developers) and
 * the data the store owns (users, reviews, comments, votes, reports).
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

/** Derived from npm for every publisher; no claim flow. */
export const developers = sqliteTable("developers", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  website: text("website"),
  githubLogin: text("github_login"),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  pluginCount: integer("plugin_count").notNull().default(0),
});

/** Created only when someone signs in with GitHub to write. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  githubId: integer("github_id").notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at").notNull().default(epoch),
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
