import type { MemberRef, ScopeRecord, ScopeStore } from "@brika/registry-core";
import { and, count, eq } from "drizzle-orm";
import type { Db } from "../client";
import { regScopes } from "../schema";

/** Cloudflare D1 implementation of the {@link ScopeStore} port (the `reg_scopes` table). */
export class D1ScopeStore implements ScopeStore {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async get(scope: string): Promise<ScopeRecord | null> {
    const rows = await this.#db.select().from(regScopes).where(eq(regScopes.scope, scope)).limit(1);
    const row = rows[0];
    return row === undefined
      ? null
      : {
          scope: row.scope,
          ownerProvider: row.ownerProvider,
          ownerId: row.ownerId,
          displayName: row.displayName,
        };
  }

  /**
   * Race-safe claim: insert only if the scope is unclaimed, then re-read. `onConflictDoNothing`
   * keeps the first writer's row (the insert is the serialization point under D1/SQLite's single
   * writer), so a loser of a concurrent claim reads back the winner's record here.
   */
  async claim(scope: string, owner: MemberRef): Promise<ScopeRecord> {
    await this.#db
      .insert(regScopes)
      .values({ scope, ownerProvider: owner.provider, ownerId: owner.id })
      .onConflictDoNothing();
    const persisted = await this.get(scope);
    if (persisted === null) throw new Error(`scope ${scope} vanished after claim`);
    return persisted;
  }

  async setDisplayName(scope: string, displayName: string | null): Promise<void> {
    await this.#db.update(regScopes).set({ displayName }).where(eq(regScopes.scope, scope));
  }

  /** Count the scopes created by this identity (the `ownerId`), for the per-user cap. */
  async countOwnedBy(owner: MemberRef): Promise<number> {
    const rows = await this.#db
      .select({ n: count() })
      .from(regScopes)
      .where(and(eq(regScopes.ownerProvider, owner.provider), eq(regScopes.ownerId, owner.id)));
    return rows[0]?.n ?? 0;
  }
}
