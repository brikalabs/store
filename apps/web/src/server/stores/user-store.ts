import { inject } from "@brika/di";
import { eq } from "drizzle-orm";
import { Database } from "@/server/db/client";
import { users } from "@/server/db/schema";

/**
 * Repository for the `users` table (the first-class Brika account). Sign-in does NOT go through
 * here - BetterAuth owns the row on sign-in - but seeds, tests, and account-derived reads do.
 * Like every store, it is the only place its table's SQL lives; callers go through
 * {@link SocialService}.
 */
export class UserStore {
  readonly #db = inject(Database).orm;

  /** Insert or update an account row (id + the provider-synced name/avatar). */
  async upsert(user: { id: string; name?: string; avatarUrl?: string }): Promise<void> {
    const name = user.name ?? null;
    await this.#db
      .insert(users)
      .values({ id: user.id, name, image: user.avatarUrl })
      .onConflictDoUpdate({ target: users.id, set: { name, image: user.avatarUrl } });
  }

  /** The account id owning a verified email, or null when none has it (scope-invite lookup). */
  async findIdByEmail(email: string): Promise<string | null> {
    const rows = await this.#db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return rows[0]?.id ?? null;
  }
}
