import type { OrgProfileInput, OrgRecord, OrgStore } from "@brika/registry-core";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { regOrgs } from "../schema";

type OrgRow = typeof regOrgs.$inferSelect;

function toRecord(row: OrgRow): OrgRecord {
  return {
    slug: row.slug,
    displayName: row.displayName,
    description: row.description,
    links: row.links ?? [],
    iconKey: row.iconKey,
    takedown: row.takedown,
  };
}

/** Cloudflare D1 implementation of the {@link OrgStore} port (the `reg_orgs` table). */
export class D1OrgStore implements OrgStore {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async get(slug: string): Promise<OrgRecord | null> {
    const rows = await this.#db.select().from(regOrgs).where(eq(regOrgs.slug, slug)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  async listAll(): Promise<OrgRecord[]> {
    const rows = await this.#db.select().from(regOrgs).orderBy(desc(regOrgs.createdAt));
    return rows.map(toRecord);
  }

  /**
   * Race-safe claim: insert only if the slug is unclaimed and report whether THIS call
   * created the row. `onConflictDoNothing().returning()` returns the inserted row on a win
   * and nothing on a conflict (the insert is the serialization point under D1/SQLite's
   * single writer), so concurrent claims of a new slug serialize and exactly one is told
   * `created: true` - that caller becomes the first admin.
   */
  async claim(slug: string): Promise<{ record: OrgRecord; created: boolean }> {
    const inserted = await this.#db
      .insert(regOrgs)
      .values({ slug })
      .onConflictDoNothing()
      .returning();
    const won = inserted[0];
    if (won !== undefined) return { record: toRecord(won), created: true };
    const persisted = await this.get(slug);
    if (persisted === null) throw new Error(`organisation ${slug} vanished after claim`);
    return { record: persisted, created: false };
  }

  async setDisplayName(slug: string, displayName: string | null): Promise<void> {
    await this.#db.update(regOrgs).set({ displayName }).where(eq(regOrgs.slug, slug));
  }

  async setProfile(slug: string, profile: OrgProfileInput): Promise<void> {
    await this.#db
      .update(regOrgs)
      .set({ description: profile.description, links: [...profile.links] })
      .where(eq(regOrgs.slug, slug));
  }

  async setIcon(slug: string, iconKey: string | null): Promise<void> {
    await this.#db.update(regOrgs).set({ iconKey }).where(eq(regOrgs.slug, slug));
  }

  async setTakedown(slug: string, reason: string | null): Promise<void> {
    await this.#db.update(regOrgs).set({ takedown: reason }).where(eq(regOrgs.slug, slug));
  }
}
