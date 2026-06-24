import { inject } from "@brika/di";
import { UserProfile } from "@brika/registry-contract";
import { eq } from "drizzle-orm";
import { avatarUrlOf } from "@/lib/avatar";
import { displayNameOf } from "@/lib/display-name";
import { Db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { BlobStore } from "@/server/ports/blob-store";

/**
 * Repository for the user-authored public profile (USER-002/003/005), columns on the `users` row.
 * The avatar resolves to the uploaded image when set (`avatar_version`), else the provider `image`;
 * the display name falls back to the provider `name` (never npm-derived).
 */
export class UserProfileStore {
  readonly #db = inject(Db);
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
   * Update the account's own profile fields (USER-003). The row always exists (BetterAuth created it
   * at sign-up); unset fields are stored as-is, never back-filled (USER-005).
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
   * Set (or clear, with null) the account's uploaded-avatar content version. The public URL is
   * derived from this at read time, never stored.
   */
  async setAvatarVersion(id: string, avatarVersion: string | null): Promise<void> {
    await this.#db.update(users).set({ avatarVersion }).where(eq(users.id, id));
  }
}
