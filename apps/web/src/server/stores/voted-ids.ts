import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import type { commentVotes, reviewVotes } from "@/server/db/schema";

/**
 * The subset of `ids` the viewer has voted on, for the per-row `viewerVoted*` flag. Shared by
 * {@link ReviewStore} and {@link CommentStore} since the two vote tables have the same shape
 * (a `(user_id, <target>_id)` pair). Returns an empty set for an anonymous viewer or no ids,
 * so the caller never special-cases the signed-out path.
 */
export async function votedIds(
  db: Db,
  table: typeof reviewVotes | typeof commentVotes,
  column: typeof reviewVotes.reviewId | typeof commentVotes.commentId,
  userId: string | null,
  ids: string[],
): Promise<Set<string>> {
  if (userId === null || ids.length === 0) return new Set();
  const rows = await db
    .select({ id: column })
    .from(table)
    .where(and(eq(table.userId, userId), inArray(column, ids)));
  return new Set(rows.map((row) => row.id));
}
