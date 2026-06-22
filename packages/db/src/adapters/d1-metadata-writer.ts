import { inject } from "@brika/di";
import type { CommitVersionInput, MetadataWriter, VersionManager } from "@brika/registry-core";
import { transactionalDb } from "@brika/tx";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Db } from "../client";
import { regDistTags, regPackages, regVersions } from "../schema";

/**
 * Persists published versions to D1 and mutates their management flags ({@link MetadataWriter} +
 * {@link VersionManager}, sharing the `reg_versions` table).
 */
export class D1MetadataWriter implements MetadataWriter, VersionManager {
  // Overlaid with `@brika/tx` so `deferBatch` statements land at the tx commit point when one is open, immediately otherwise.
  readonly #db = transactionalDb<Db, BatchItem<"sqlite">>(inject(Db));

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

    // Atomic unit: a duplicate version trips the unique constraint and fails the whole batch,
    // so a TOCTOU race past `versionExists` cannot corrupt an existing version.
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
   * Point `latest` at the newest *installable* version (not yanked, not taken down); remove the tag
   * when every version is hidden. Otherwise `latest` could resolve to a version `bun add` cannot fetch,
   * and the storefront catalog (joins `latest`, drops yanked) would hide the whole package.
   *
   * The pick is resolved IN SQL ordered by publish time then `version DESC`: `publishedAt` is truncated
   * to whole seconds, so a bulk publish can tie, and a JS `reduce` with no tie-break would let row order
   * pick a lower version. The read-then-write is two statements, so a publish between them can still race
   * (the same single-writer assumption the publish path's `latest` upsert makes); a yank is rare next to it.
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
