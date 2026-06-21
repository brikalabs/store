import { inject } from "@brika/di";
import { Comment } from "@brika/registry-contract";
import { and, eq, sql } from "drizzle-orm";
import { avatarUrlOf } from "@/lib/avatar";
import { displayNameOf } from "@/lib/display-name";
import { Database } from "@/server/db/client";
import { comments, commentVotes, userProfiles, users } from "@/server/db/schema";
import { votedIds } from "@/server/stores/voted-ids";

/**
 * Repository for `comments` (+ the `comment_votes` upvote tally). Reads project a comment into
 * the {@link Comment} contract, joining `users`/`user_profiles` for the author's display name
 * and avatar; a deleted comment keeps its row (for thread structure) but its body reads as
 * `[deleted]`.
 */
export class CommentStore {
  readonly #db = inject(Database).orm;

  /** Every comment of a plugin, oldest first, with upvote totals + the viewer's vote state. */
  async listForPlugin(pluginName: string, viewerId: string | null = null): Promise<Comment[]> {
    const rows = await this.#db
      .select({
        id: comments.id,
        parentId: comments.parentId,
        body: comments.body,
        createdAt: comments.createdAt,
        edited: comments.edited,
        deleted: comments.deleted,
        userId: users.id,
        name: users.name,
        profileDisplayName: userProfiles.displayName,
        image: users.image,
        uploadedAvatar: userProfiles.avatarUrl,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(comments.pluginName, pluginName))
      .orderBy(comments.createdAt);

    const [upvotes, voted] = await Promise.all([
      this.#upvoteCounts(pluginName),
      votedIds(
        this.#db,
        commentVotes,
        commentVotes.commentId,
        viewerId,
        rows.map((row) => row.id),
      ),
    ]);

    return rows.map((row) =>
      Comment.parse({
        id: row.id,
        pluginName,
        parentId: row.parentId,
        author: {
          id: row.userId,
          displayName: displayNameOf(row.profileDisplayName, row.name),
          avatarUrl: avatarUrlOf(row.uploadedAvatar, row.image),
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

  /** Post a comment (or a reply when `parentId` is set). */
  async add(
    pluginName: string,
    userId: string,
    body: string,
    parentId: string | null,
  ): Promise<void> {
    await this.#db
      .insert(comments)
      .values({ id: crypto.randomUUID(), pluginName, userId, body, parentId });
  }

  /**
   * Toggle the viewer's upvote on a comment. Idempotent per (user, comment); returns false when
   * the comment is missing or deleted, or the user is its author (no self-upvote).
   */
  async toggleUpvote(commentId: string, userId: string): Promise<boolean> {
    const found = await this.#db
      .select({ authorId: comments.userId, deleted: comments.deleted })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    const comment = found[0];
    if (comment === undefined || comment.deleted || comment.authorId === userId) return false;

    const existing = await this.#db
      .select({ userId: commentVotes.userId })
      .from(commentVotes)
      .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)))
      .limit(1);
    if (existing[0] === undefined) {
      await this.#db.insert(commentVotes).values({ commentId, userId, value: 1 });
    } else {
      await this.#db
        .delete(commentVotes)
        .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)));
    }
    return true;
  }

  /** Upvote totals per comment for a plugin, keyed by comment id. */
  async #upvoteCounts(pluginName: string): Promise<Map<string, number>> {
    const rows = await this.#db
      .select({ commentId: commentVotes.commentId, count: sql<number>`count(*)` })
      .from(commentVotes)
      .innerJoin(comments, eq(commentVotes.commentId, comments.id))
      .where(eq(comments.pluginName, pluginName))
      .groupBy(commentVotes.commentId);
    return new Map(rows.map((row) => [row.commentId, row.count]));
  }
}
