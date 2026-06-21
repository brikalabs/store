import { inject } from "@brika/di";
import { eq } from "drizzle-orm";
import { Database } from "@/server/db/client";
import { users } from "@/server/db/schema";

/**
 * Repository for the `users` table (the first-class Brika account). Sign-in does NOT go through
 * here - BetterAuth owns the row on GitHub sign-in - but seeds, tests, and account-derived reads
 * (e.g. "this account's GitHub login") do. Like every store, it is the only place its table's
 * SQL lives; callers go through {@link SocialService}.
 */
export class UserStore {
  readonly #db = inject(Database).orm;

  /**
   * Insert or update an account row. `name` is always stored (falling back to `login`) so a
   * display name is guaranteed in the DB, mirroring `mapProfileToUser` at sign-in; the old
   * `avatarUrl` maps to the BetterAuth `image` column.
   */
  async upsert(user: {
    id: string;
    login: string;
    name?: string;
    avatarUrl?: string;
  }): Promise<void> {
    const name = user.name ?? user.login;
    await this.#db
      .insert(users)
      .values({ id: user.id, login: user.login, name, image: user.avatarUrl })
      .onConflictDoUpdate({
        target: users.id,
        set: { login: user.login, name, image: user.avatarUrl },
      });
  }

  /** The account's GitHub login (the scope-ownership / publish identity), or null if unknown. */
  async findLogin(id: string): Promise<string | null> {
    const rows = await this.#db
      .select({ login: users.login })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0]?.login ?? null;
  }
}
