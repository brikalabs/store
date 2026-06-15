import {
  type Comment,
  Comment as CommentSchema,
  DeveloperProfile,
  type RatingSummary,
  Review,
} from "@brika/registry-contract";
import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { comments, developers, plugins, reviews, users } from "../db/schema";
import { getPluginPage } from "./registry";

/** Upsert the GitHub user behind a session. */
export async function upsertUser(
  database: Db,
  user: { id: string; githubId: number; login: string; name?: string; avatarUrl?: string },
): Promise<void> {
  await database
    .insert(users)
    .values({
      id: user.id,
      githubId: user.githubId,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { login: user.login, name: user.name, avatarUrl: user.avatarUrl },
    });
}

/**
 * Verified-author heuristic: an npm maintainer id equal to the GitHub login is
 * marked verified once that GitHub user signs in.
 */
export async function markDeveloperVerified(database: Db, githubLogin: string): Promise<void> {
  await database
    .update(developers)
    .set({ verified: true, githubLogin })
    .where(eq(developers.id, githubLogin));
}

/**
 * Ensure a plugin row exists so reviews/comments can reference it (cache-aside
 * write from npm). Returns false when the package is not a Brika plugin.
 */
export async function ensurePluginCached(database: Db, name: string): Promise<boolean> {
  const existing = await database
    .select({ name: plugins.name })
    .from(plugins)
    .where(eq(plugins.name, name))
    .limit(1);
  if (existing[0] !== undefined) return true;

  const page = await getPluginPage(name);
  if (page === null) return false;
  const detail = page.detail;

  await database
    .insert(plugins)
    .values({
      name: detail.name,
      displayName: detail.displayName,
      description: detail.description,
      latestVersion: detail.version,
      repository: detail.repository,
      homepage: detail.homepage,
      license: detail.license,
      keywords: detail.keywords,
      authorId: detail.author?.id,
      downloadsWeekly: detail.downloadsWeekly,
      brikaEngine: detail.brikaEngine,
      capabilities: detail.capabilities,
      grants: detail.grants,
    })
    .onConflictDoNothing();

  if (detail.author !== undefined) {
    await database
      .insert(developers)
      .values({ id: detail.author.id, displayName: detail.author.name ?? detail.author.id })
      .onConflictDoNothing();
  }
  return true;
}

async function recomputeRating(database: Db, pluginName: string): Promise<void> {
  const rows = await database
    .select({ average: sql<number>`avg(${reviews.rating})`, count: sql<number>`count(*)` })
    .from(reviews)
    .where(eq(reviews.pluginName, pluginName));
  const row = rows[0];
  await database
    .update(plugins)
    .set({ ratingAverage: row?.average ?? 0, ratingCount: row?.count ?? 0 })
    .where(eq(plugins.name, pluginName));
}

export async function listReviews(database: Db, pluginName: string): Promise<Review[]> {
  const rows = await database
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      versionReviewed: reviews.versionReviewed,
      helpfulCount: reviews.helpfulCount,
      createdAt: reviews.createdAt,
      edited: reviews.edited,
      userId: users.id,
      login: users.login,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.pluginName, pluginName))
    .orderBy(desc(reviews.createdAt));

  return rows.map((row) =>
    Review.parse({
      id: row.id,
      pluginName,
      author: {
        id: row.userId,
        login: row.login,
        name: row.name ?? undefined,
        avatarUrl: row.avatarUrl ?? undefined,
      },
      rating: row.rating,
      title: row.title ?? undefined,
      body: row.body,
      versionReviewed: row.versionReviewed ?? undefined,
      helpfulCount: row.helpfulCount,
      createdAt: new Date(row.createdAt * 1000).toISOString(),
      edited: row.edited,
    }),
  );
}

export async function upsertReview(
  database: Db,
  pluginName: string,
  userId: string,
  input: { rating: number; title?: string; body: string; versionReviewed?: string },
): Promise<void> {
  await database
    .insert(reviews)
    .values({
      id: crypto.randomUUID(),
      pluginName,
      userId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      versionReviewed: input.versionReviewed,
    })
    .onConflictDoUpdate({
      target: [reviews.userId, reviews.pluginName],
      set: {
        rating: input.rating,
        title: input.title,
        body: input.body,
        versionReviewed: input.versionReviewed,
        edited: true,
        updatedAt: sql`(unixepoch())`,
      },
    });
  await recomputeRating(database, pluginName);
}

export async function getRatingSummary(
  database: Db,
  pluginName: string,
): Promise<RatingSummary | undefined> {
  const rows = await database
    .select({ average: plugins.ratingAverage, count: plugins.ratingCount })
    .from(plugins)
    .where(eq(plugins.name, pluginName))
    .limit(1);
  const row = rows[0];
  if (row === undefined || row.count === 0) return undefined;
  return { average: row.average, count: row.count };
}

export async function listComments(database: Db, pluginName: string): Promise<Comment[]> {
  const rows = await database
    .select({
      id: comments.id,
      parentId: comments.parentId,
      body: comments.body,
      createdAt: comments.createdAt,
      edited: comments.edited,
      deleted: comments.deleted,
      userId: users.id,
      login: users.login,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.pluginName, pluginName))
    .orderBy(comments.createdAt);

  return rows.map((row) =>
    CommentSchema.parse({
      id: row.id,
      pluginName,
      parentId: row.parentId,
      author: {
        id: row.userId,
        login: row.login,
        name: row.name ?? undefined,
        avatarUrl: row.avatarUrl ?? undefined,
      },
      body: row.deleted ? "[deleted]" : row.body,
      createdAt: new Date(row.createdAt * 1000).toISOString(),
      edited: row.edited,
      deleted: row.deleted,
    }),
  );
}

export async function addComment(
  database: Db,
  pluginName: string,
  userId: string,
  body: string,
  parentId: string | null,
): Promise<void> {
  await database
    .insert(comments)
    .values({ id: crypto.randomUUID(), pluginName, userId, body, parentId });
}

/** The editable developer profile (defaults to the npm-derived values). */
export async function getDeveloperProfile(database: Db, id: string): Promise<DeveloperProfile> {
  const rows = await database.select().from(developers).where(eq(developers.id, id)).limit(1);
  const row = rows[0];
  return DeveloperProfile.parse({
    id,
    displayName: row?.displayName ?? id,
    avatarUrl: row?.avatarUrl ?? undefined,
    bio: row?.bio ?? undefined,
    website: row?.website ?? undefined,
    githubLogin: row?.githubLogin ?? undefined,
    verified: row?.verified ?? false,
    pluginCount: row?.pluginCount ?? 0,
  });
}

export async function updateDeveloperProfile(
  database: Db,
  id: string,
  fields: { displayName?: string; bio?: string; website?: string },
): Promise<void> {
  await database
    .insert(developers)
    .values({ id, displayName: fields.displayName, bio: fields.bio, website: fields.website })
    .onConflictDoUpdate({
      target: developers.id,
      set: { displayName: fields.displayName, bio: fields.bio, website: fields.website },
    });
}
