import type { CommitVersionInput, MetadataWriter, VersionManager } from "@brika/registry-core";
import { type TransactionalDb, transactionalDb } from "@brika/tx";
import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "../client";
import { regDistTags, regPackages, regVersions } from "../schema";

/**
 * Persists a published version to D1 and mutates its management flags. Covers
 * both the publish writer (`MetadataWriter`) and the post-publish manager
 * (`VersionManager`) since they share the same `reg_versions` table.
 *
 * The client is overlaid with `@brika/tx`'s `transactionalDb`, so the writer is
 * transaction-aware for free: `commitVersion` just hands its statements to
 * `deferBatch` and the unit of work decides when they land (at the tx commit point
 * when one is open, immediately otherwise) - no batch/timing logic here.
 */
export class D1MetadataWriter implements MetadataWriter, VersionManager {
  readonly #db: Db & TransactionalDb<BatchItem<"sqlite">>;

  constructor(db: Db) {
    this.#db = transactionalDb<Db, BatchItem<"sqlite">>(db);
  }

  async versionExists(name: string, version: string): Promise<boolean> {
    const rows = await this.#db
      .select({ name: regVersions.name })
      .from(regVersions)
      .where(and(eq(regVersions.name, name), eq(regVersions.version, version)))
      .limit(1);
    return rows[0] !== undefined;
  }

  async commitVersion({ scope, version, tag }: CommitVersionInput): Promise<void> {
    const statements = [
      this.#db.insert(regPackages).values({ name: version.name, scope }).onConflictDoNothing(),
      this.#db.insert(regVersions).values({
        name: version.name,
        version: version.version,
        manifest: version.manifest,
        integrity: version.integrity,
        shasum: version.shasum,
        size: version.size,
        publishedAt: Math.floor(new Date(version.publishedAt).getTime() / 1000),
        deprecated: version.deprecated,
        yanked: version.yanked,
        provenance: version.provenance ?? undefined,
      }),
      this.#db
        .insert(regDistTags)
        .values({ name: version.name, tag, version: version.version })
        .onConflictDoUpdate({
          target: [regDistTags.name, regDistTags.tag],
          set: { version: version.version },
        }),
    ];

    // One transaction-aware unit: lands atomically at the publish's commit point (so a
    // later failure still rolls the staged tarball back), or immediately when there is
    // no open transaction. A duplicate version trips the unique constraint and fails the
    // whole unit, so a TOCTOU race past `versionExists` cannot corrupt an existing one.
    await this.#db.deferBatch(statements);
  }

  async setDeprecated(name: string, version: string, message: string | null): Promise<void> {
    await this.#db
      .update(regVersions)
      .set({ deprecated: message })
      .where(and(eq(regVersions.name, name), eq(regVersions.version, version)));
  }

  async setYanked(name: string, version: string, yanked: boolean): Promise<void> {
    await this.#db
      .update(regVersions)
      .set({ yanked })
      .where(and(eq(regVersions.name, name), eq(regVersions.version, version)));
  }

  async setTakedown(name: string, version: string, reason: string | null): Promise<void> {
    await this.#db
      .update(regVersions)
      .set({ takedown: reason })
      .where(and(eq(regVersions.name, name), eq(regVersions.version, version)));
  }
}
