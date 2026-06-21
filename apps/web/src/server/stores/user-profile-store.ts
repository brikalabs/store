import { UserProfile } from "@brika/registry-contract";
import { eq } from "drizzle-orm";
import { displayNameOf } from "@/lib/display-name";
import type { Db } from "@/server/db/client";
import { userProfiles, users } from "@/server/db/schema";

/**
 * Repository for the user-authored public profile (`user_profiles`, USER-002/003/005), keyed
 * 1:1 to a `users` row. The editable fields (displayName/bio/website/links) live here; the
 * avatar always comes from the GitHub `image` on `users`, and the display name falls back to
 * the GitHub `name` (never npm-derived). Reads join `users` to resolve those fallbacks.
 */
export class UserProfileStore {
  constructor(private readonly db: Db) {}

  /** The account's public profile by opaque account id, or null when the account is unknown. */
  async get(id: string): Promise<UserProfile | null> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        image: users.image,
        displayName: userProfiles.displayName,
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
      avatarUrl: row.image ?? undefined,
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
    await this.db
      .insert(userProfiles)
      .values({ userId: id, ...values })
      .onConflictDoUpdate({ target: userProfiles.userId, set: values });
  }
}
