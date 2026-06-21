import { inject } from "@brika/di";
import { UserProfile } from "@brika/registry-contract";
import { eq } from "drizzle-orm";
import { avatarUrlOf } from "@/lib/avatar";
import { displayNameOf } from "@/lib/display-name";
import { Database } from "@/server/db/client";
import { userProfiles, users } from "@/server/db/schema";
import { BlobStore } from "@/server/ports/blob-store";

/**
 * Repository for the user-authored public profile (`user_profiles`, USER-002/003/005), keyed
 * 1:1 to a `users` row. The editable fields (displayName/bio/website/links/avatar) live here; the
 * avatar resolves to the account's uploaded image when set (`avatar_version`) and otherwise the GitHub
 * `image` on `users`, and the display name falls back to the GitHub `name` (never npm-derived).
 * Reads join `users` to resolve those fallbacks.
 */
export class UserProfileStore {
  readonly #db = inject(Database).orm;
  readonly #blob = inject(BlobStore);

  /** The account's public profile by opaque account id, or null when the account is unknown. */
  async get(id: string): Promise<UserProfile | null> {
    const rows = await this.#db
      .select({
        id: users.id,
        name: users.name,
        image: users.image,
        displayName: userProfiles.displayName,
        avatarVersion: userProfiles.avatarVersion,
        bio: userProfiles.bio,
        website: userProfiles.website,
        links: userProfiles.links,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
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
   * Upsert the account's own profile fields (USER-003). The caller passes the session
   * `users.id`, so a user only ever writes their own row; unset fields are stored as-is
   * (empty, never back-filled from npm, USER-005).
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
    const values = {
      displayName: fields.displayName ?? null,
      bio: fields.bio ?? null,
      website: fields.website ?? null,
      links: fields.links ?? [],
    };
    await this.#db
      .insert(userProfiles)
      .values({ userId: id, ...values })
      .onConflictDoUpdate({ target: userProfiles.userId, set: values });
  }

  /**
   * Set (or clear, with null) the account's uploaded-avatar content version, leaving the other
   * profile fields untouched. The caller passes the session `users.id`, so a user only writes its
   * own row. The public URL is derived from this at read time, never stored.
   */
  async setAvatarVersion(id: string, avatarVersion: string | null): Promise<void> {
    await this.#db
      .insert(userProfiles)
      .values({ userId: id, avatarVersion })
      .onConflictDoUpdate({ target: userProfiles.userId, set: { avatarVersion } });
  }
}
