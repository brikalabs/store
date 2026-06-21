import { inject } from "@brika/di";
import { Review } from "@brika/registry-contract";
import { and, desc, eq, sql } from "drizzle-orm";
import { displayNameOf } from "@/lib/display-name";
import { Database } from "@/server/db/client";
import { reviews, reviewVotes, userProfiles, users } from "@/server/db/schema";
import { votedIds } from "@/server/stores/voted-ids";

/** A new or edited review's content (the rating + text the author submits). */
export interface ReviewInput {
  rating: number;
  title?: string;
  body: string;
  versionReviewed?: string;
}

/**
 * Repository for `reviews` (+ the `review_votes` helpful tally). Read methods project a review
 * into the {@link Review} contract, joining `users`/`user_profiles` to resolve the author's one
 * display name and avatar. The rating denormalization on the `plugins` row is a separate
 * concern, recomputed by {@link PluginStore} after a write (orchestrated by the service).
 */
export class ReviewStore {
  readonly #db = inject(Database).orm;

  /** Every review of a plugin, newest first, with the viewer's helpful-vote state. */
  async listForPlugin(pluginName: string, viewerId: string | null = null): Promise<Review[]> {
    const rows = await this.#db
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
        name: users.name,
        profileDisplayName: userProfiles.displayName,
        avatarUrl: users.image,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(reviews.pluginName, pluginName))
      .orderBy(desc(reviews.createdAt));

    const voted = await votedIds(
      this.#db,
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
          displayName: displayNameOf(row.profileDisplayName, row.name),
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

  /** Every review authored by an account, newest first (for the public profile page). */
  async listByUser(userId: string): Promise<Review[]> {
    const rows = await this.#db
      .select({
        id: reviews.id,
        pluginName: reviews.pluginName,
        rating: reviews.rating,
        title: reviews.title,
        body: reviews.body,
        versionReviewed: reviews.versionReviewed,
        helpfulCount: reviews.helpfulCount,
        createdAt: reviews.createdAt,
        edited: reviews.edited,
        authorId: users.id,
        name: users.name,
        profileDisplayName: userProfiles.displayName,
        avatarUrl: users.image,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.createdAt));

    return rows.map((row) =>
      Review.parse({
        id: row.id,
        pluginName: row.pluginName,
        author: {
          id: row.authorId,
          displayName: displayNameOf(row.profileDisplayName, row.name),
          avatarUrl: row.avatarUrl ?? undefined,
        },
        rating: row.rating,
        title: row.title ?? undefined,
        body: row.body,
        versionReviewed: row.versionReviewed ?? undefined,
        helpfulCount: row.helpfulCount,
        viewerVotedHelpful: false,
        createdAt: new Date(row.createdAt * 1000).toISOString(),
        edited: row.edited,
      }),
    );
  }

  /** Insert or edit the account's single review of a plugin (one row per user+plugin). */
  async upsert(pluginName: string, userId: string, input: ReviewInput): Promise<void> {
    await this.#db
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
  }

  /**
   * Toggle the viewer's "helpful" vote and refresh `helpful_count` from the authoritative vote
   * rows. Idempotent per (user, review); the author may not vote on their own review. Returns
   * false when the review does not exist.
   */
  async toggleHelpful(reviewId: string, userId: string): Promise<boolean> {
    const found = await this.#db
      .select({ authorId: reviews.userId })
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);
    const review = found[0];
    if (review === undefined || review.authorId === userId) return false;

    const existing = await this.#db
      .select({ userId: reviewVotes.userId })
      .from(reviewVotes)
      .where(and(eq(reviewVotes.reviewId, reviewId), eq(reviewVotes.userId, userId)))
      .limit(1);
    if (existing[0] === undefined) {
      await this.#db.insert(reviewVotes).values({ reviewId, userId, value: 1 });
    } else {
      await this.#db
        .delete(reviewVotes)
        .where(and(eq(reviewVotes.reviewId, reviewId), eq(reviewVotes.userId, userId)));
    }

    const counted = await this.#db
      .select({ count: sql<number>`count(*)` })
      .from(reviewVotes)
      .where(eq(reviewVotes.reviewId, reviewId));
    await this.#db
      .update(reviews)
      .set({ helpfulCount: counted[0]?.count ?? 0 })
      .where(eq(reviews.id, reviewId));
    return true;
  }
}
