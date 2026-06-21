import type { CommitVersionInput, MetadataWriter, VersionManager } from "@brika/registry-core";
import { type TransactionalDb, transactionalDb } from "@brika/tx";
import { and, desc, eq, isNull } from "drizzle-orm";
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
    await this.#refreshLatestTag(name);
  }

  async setTakedown(name: string, version: string, reason: string | null): Promise<void> {
    await this.#db
      .update(regVersions)
      .set({ takedown: reason })
      .where(and(eq(regVersions.name, name), eq(regVersions.version, version)));
    await this.#refreshLatestTag(name);
  }

  /**
   * Keep the `latest` dist-tag pointing at the newest *installable* version (not yanked, not
   * taken down). Yank/takedown omit a version from the packument; if `latest` still pointed at
   * it, `bun add` would resolve a version that isn't there and the storefront catalog (which
   * joins `latest` then drops yanked rows) would hide the whole package even when older versions
   * still install. When every version is hidden the tag is removed, so the package is unlisted
   * publicly but its row survives for its owner to un-yank.
   *
   * The "newest installable" pick is resolved IN SQL, ordered by publish time then version, so it
   * is deterministic: `publishedAt` is stored truncated to whole seconds, so a bulk/CI publish can
   * tie, and a JS `reduce` with no tie-break would let the engine's row order decide `latest` (and
   * possibly pick a lower version). `version DESC` breaks the tie stably.
   *
   * Caveat: the read-then-write is two statements, so a publish landing between them can still race
   * (the same single-writer assumption the publish path's unconditional `latest` upsert already
   * makes); D1 has no interactive transaction to close that window, and a yank is rare next to it.
   */
  async #refreshLatestTag(name: string): Promise<void> {
    const newest = await this.#db
      .select({ version: regVersions.version })
      .from(regVersions)
      .where(
        and(
          eq(regVersions.name, name),
          eq(regVersions.yanked, false),
          isNull(regVersions.takedown),
        ),
      )
      .orderBy(desc(regVersions.publishedAt), desc(regVersions.version))
      .limit(1);
    const version = newest[0]?.version;
    if (version === undefined) {
      await this.#db
        .delete(regDistTags)
        .where(and(eq(regDistTags.name, name), eq(regDistTags.tag, "latest")));
      return;
    }
    await this.#db
      .insert(regDistTags)
      .values({ name, tag: "latest", version })
      .onConflictDoUpdate({
        target: [regDistTags.name, regDistTags.tag],
        set: { version },
      });
  }
}
