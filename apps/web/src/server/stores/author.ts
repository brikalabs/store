import { avatarUrlOf } from "@/lib/avatar";
import { displayNameOf } from "@/lib/display-name";
import { users } from "@/server/db/schema";
import type { BlobStore } from "@/server/ports/blob-store";

/**
 * The author columns to select alongside a review/comment (the joined `users` row), shared by
 * {@link ReviewStore} and {@link CommentStore}. Spread into a `.select({ ...authorColumns })`.
 */
export const authorColumns = {
  authorId: users.id,
  name: users.name,
  profileDisplayName: users.displayName,
  image: users.image,
  avatarVersion: users.avatarVersion,
} as const;

/** A row carrying the selected {@link authorColumns}. */
export interface AuthorRow {
  readonly authorId: string;
  readonly name: string | null;
  readonly profileDisplayName: string | null;
  readonly image: string | null;
  readonly avatarVersion: string | null;
}

/** Project {@link authorColumns} into the contract's `author` (one display name + resolved avatar). */
export function toAuthor(blobs: Pick<BlobStore, "url">, row: AuthorRow) {
  return {
    id: row.authorId,
    displayName: displayNameOf(row.profileDisplayName, row.name),
    avatarUrl: avatarUrlOf(blobs, row.avatarVersion, row.authorId, row.image),
  };
}
