import {
  type Comment,
  Comment as CommentSchema,
  DeveloperProfile,
  type RatingSummary,
  Review,
} from "@brika/registry-contract";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getPluginPage } from "@/lib/registry/registry";
import type { Db } from "@/server/db/client";
import {
  comments,
  commentVotes,
  developers,
  plugins,
  reviews,
  reviewVotes,
  users,
} from "@/server/db/schema";

/**
 * Upsert a user row directly. Sign-in no longer goes through here — BetterAuth
 * creates/updates the `users` row on GitHub sign-in — but seeds and tests still
 * insert users directly with a `login` (and now map the old `avatarUrl` to the
 * BetterAuth `image` column).
 */
export async function upsertUser(
  database: Db,
  user: { id: string; login: string; name?: string; avatarUrl?: string },
): Promise<void> {
  await database
    .insert(users)
    .values({
      id: user.id,
      login: user.login,
      name: user.name,
      image: user.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { login: user.login, name: user.name, image: user.avatarUrl },
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

/** The subset of `ids` the user has cast a vote on, for the viewer-state flag. */
async function votedIds(
  database: Db,
  table: typeof reviewVotes | typeof commentVotes,
  column: typeof reviewVotes.reviewId | typeof commentVotes.commentId,
  userId: string | null,
  ids: string[],
): Promise<Set<string>> {
  if (userId === null || ids.length === 0) return new Set();
  const rows = await database
    .select({ id: column })
    .from(table)
    .where(and(eq(table.userId, userId), inArray(column, ids)));
  return new Set(rows.map((row) => row.id));
}

export async function listReviews(
  database: Db,
  pluginName: string,
  viewerId: string | null = null,
): Promise<Review[]> {
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
      avatarUrl: users.image,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.pluginName, pluginName))
    .orderBy(desc(reviews.createdAt));

  const voted = await votedIds(
    database,
    reviewVotes,
    reviewVotes.reviewId,
    viewerId,
    rows.map((row) => row.id),
  );

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
      viewerVotedHelpful: voted.has(row.id),
      createdAt: new Date(row.createdAt * 1000).toISOString(),
      edited: row.edited,
    }),
  );
}

/**
 * Toggle the requesting user's "helpful" vote on a review and refresh the
 * review's `helpfulCount` from the authoritative vote rows. Idempotent per
 * (user, review): a second call removes the vote. Returns false when the review
 * does not exist. The review's own author may not vote on it.
 */
export async function toggleReviewHelpful(
  database: Db,
  reviewId: string,
  userId: string,
): Promise<boolean> {
  const found = await database
    .select({ authorId: reviews.userId })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);
  const review = found[0];
  if (review === undefined || review.authorId === userId) return false;

  const existing = await database
    .select({ userId: reviewVotes.userId })
    .from(reviewVotes)
    .where(and(eq(reviewVotes.reviewId, reviewId), eq(reviewVotes.userId, userId)))
    .limit(1);
  if (existing[0] === undefined) {
    await database.insert(reviewVotes).values({ reviewId, userId, value: 1 });
  } else {
    await database
      .delete(reviewVotes)
      .where(and(eq(reviewVotes.reviewId, reviewId), eq(reviewVotes.userId, userId)));
  }

  const counted = await database
    .select({ count: sql<number>`count(*)` })
    .from(reviewVotes)
    .where(eq(reviewVotes.reviewId, reviewId));
  await database
    .update(reviews)
    .set({ helpfulCount: counted[0]?.count ?? 0 })
    .where(eq(reviews.id, reviewId));
  return true;
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

/** Upvote totals per comment for a plugin, keyed by comment id. */
async function commentUpvoteCounts(database: Db, pluginName: string): Promise<Map<string, number>> {
  const rows = await database
    .select({ commentId: commentVotes.commentId, count: sql<number>`count(*)` })
    .from(commentVotes)
    .innerJoin(comments, eq(commentVotes.commentId, comments.id))
    .where(eq(comments.pluginName, pluginName))
    .groupBy(commentVotes.commentId);
  return new Map(rows.map((row) => [row.commentId, row.count]));
}

export async function listComments(
  database: Db,
  pluginName: string,
  viewerId: string | null = null,
): Promise<Comment[]> {
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
      avatarUrl: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.pluginName, pluginName))
    .orderBy(comments.createdAt);

  const [upvotes, voted] = await Promise.all([
    commentUpvoteCounts(database, pluginName),
    votedIds(
      database,
      commentVotes,
      commentVotes.commentId,
      viewerId,
      rows.map((row) => row.id),
    ),
  ]);

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
      upvotes: upvotes.get(row.id) ?? 0,
      viewerUpvoted: voted.has(row.id),
      createdAt: new Date(row.createdAt * 1000).toISOString(),
      edited: row.edited,
      deleted: row.deleted,
    }),
  );
}

/**
 * Toggle the requesting user's upvote on a comment. Idempotent per (user,
 * comment). Returns false when the comment does not exist or is deleted; a user
 * may not upvote their own comment.
 */
export async function toggleCommentUpvote(
  database: Db,
  commentId: string,
  userId: string,
): Promise<boolean> {
  const found = await database
    .select({ authorId: comments.userId, deleted: comments.deleted })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  const comment = found[0];
  if (comment === undefined || comment.deleted || comment.authorId === userId) return false;

  const existing = await database
    .select({ userId: commentVotes.userId })
    .from(commentVotes)
    .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)))
    .limit(1);
  if (existing[0] === undefined) {
    await database.insert(commentVotes).values({ commentId, userId, value: 1 });
  } else {
    await database
      .delete(commentVotes)
      .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)));
  }
  return true;
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
