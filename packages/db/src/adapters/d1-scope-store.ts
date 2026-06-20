import type { OrgProfileInput, ScopeRecord, ScopeStore } from "@brika/registry-core";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { regScopes } from "../schema";

type ScopeRow = typeof regScopes.$inferSelect;

function toRecord(row: ScopeRow): ScopeRecord {
  return {
    scope: row.scope,
    displayName: row.displayName,
    description: row.description,
    links: row.links ?? [],
    iconKey: row.iconKey,
    takedown: row.takedown,
  };
}

/** Cloudflare D1 implementation of the {@link ScopeStore} port (the `reg_scopes` table). */
export class D1ScopeStore implements ScopeStore {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async get(scope: string): Promise<ScopeRecord | null> {
    const rows = await this.#db.select().from(regScopes).where(eq(regScopes.scope, scope)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  async listAll(): Promise<ScopeRecord[]> {
    const rows = await this.#db.select().from(regScopes).orderBy(desc(regScopes.createdAt));
    return rows.map(toRecord);
  }

  /**
   * Race-safe claim: insert only if the scope is unclaimed and report whether THIS call
   * created the row. `onConflictDoNothing().returning()` returns the inserted row on a win
   * and nothing on a conflict (the insert is the serialization point under D1/SQLite's
   * single writer), so concurrent claims of a new scope serialize and exactly one is told
   * `created: true` - that caller becomes the first admin.
   */
  async claim(scope: string): Promise<{ record: ScopeRecord; created: boolean }> {
    const inserted = await this.#db
      .insert(regScopes)
      .values({ scope })
      .onConflictDoNothing()
      .returning();
    const won = inserted[0];
    if (won !== undefined) return { record: toRecord(won), created: true };
    const persisted = await this.get(scope);
    if (persisted === null) throw new Error(`scope ${scope} vanished after claim`);
    return { record: persisted, created: false };
  }

  async setDisplayName(scope: string, displayName: string | null): Promise<void> {
    await this.#db.update(regScopes).set({ displayName }).where(eq(regScopes.scope, scope));
  }

  async setProfile(scope: string, profile: OrgProfileInput): Promise<void> {
    await this.#db
      .update(regScopes)
      .set({ description: profile.description, links: [...profile.links] })
      .where(eq(regScopes.scope, scope));
  }

  async setIcon(scope: string, iconKey: string | null): Promise<void> {
    await this.#db.update(regScopes).set({ iconKey }).where(eq(regScopes.scope, scope));
  }

  async setTakedown(scope: string, reason: string | null): Promise<void> {
    await this.#db.update(regScopes).set({ takedown: reason }).where(eq(regScopes.scope, scope));
  }
}
