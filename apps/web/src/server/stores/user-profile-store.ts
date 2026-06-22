import { inject } from "@brika/di";
import { UserProfile } from "@brika/registry-contract";
import { eq } from "drizzle-orm";
import { avatarUrlOf } from "@/lib/avatar";
import { displayNameOf } from "@/lib/display-name";
import { Database } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { BlobStore } from "@/server/ports/blob-store";

/**
 * Repository for the user-authored public profile (USER-002/003/005), now columns on the
 * `users` row itself (no separate `user_profiles` table). The editable fields
 * (displayName/bio/website/links/avatar) live alongside the provider-synced `name`/`image`:
 * the avatar resolves to the account's uploaded image when set (`avatar_version`) and otherwise
 * the provider `image`, and the display name falls back to the provider `name` (never
 * npm-derived).
 */
export class UserProfileStore {
  readonly #db = inject(Database);
  readonly #blob = inject(BlobStore);

  /** The account's public profile by opaque account id, or null when the account is unknown. */
  async get(id: string): Promise<UserProfile | null> {
    const rows = await this.#db
      .select({
        id: users.id,
        name: users.name,
        image: users.image,
        displayName: users.displayName,
        avatarVersion: users.avatarVersion,
        bio: users.bio,
        website: users.website,
        links: users.links,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const row = rows[0];
    if (row === undefined) return null;
    return UserProfile.parse({
      id: row.id,
      displayName: displayNameOf(row.displayName, row.name),
      avatarUrl: avatarUrlOf(this.#blob, row.avatarVersion, row.id, row.image),
      bio: row.bio ?? undefined,
      website: row.website ?? undefined,
      links: row.links ?? [],
    });
  }

  /**
   * Update the account's own profile fields (USER-003). The caller passes the session
   * `users.id` (the row always exists - BetterAuth created it at sign-up), so a user only ever
   * writes their own row; unset fields are stored as-is (empty, never back-filled, USER-005).
   */
  async upsert(
    id: string,
    fields: {
      displayName?: string;
      bio?: string;
      website?: string;
      links?: { label: string; url: string }[];
    },
  ): Promise<void> {
    await this.#db
      .update(users)
      .set({
        displayName: fields.displayName ?? null,
        bio: fields.bio ?? null,
        website: fields.website ?? null,
        links: fields.links ?? [],
      })
      .where(eq(users.id, id));
  }

  /**
   * Set (or clear, with null) the account's uploaded-avatar content version, leaving the other
   * profile fields untouched. The caller passes the session `users.id`, so a user only writes its
   * own row. The public URL is derived from this at read time, never stored.
   */
  async setAvatarVersion(id: string, avatarVersion: string | null): Promise<void> {
    await this.#db.update(users).set({ avatarVersion }).where(eq(users.id, id));
  }
}
