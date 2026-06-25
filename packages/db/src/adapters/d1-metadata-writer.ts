import { inject } from "@brika/di";
import type { CommitVersionInput, MetadataWriter, VersionManager } from "@brika/registry-core";
import { transactionalDb } from "@brika/tx";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Db } from "../client";
import { regDistTags, regKeywords, regPackages, regSearch, regVersions } from "../schema";

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

  async packageExists(name: string): Promise<boolean> {
    const rows = await this.#db
      .select({ name: regPackages.name })
      .from(regPackages)
      .where(eq(regPackages.name, name))
      .limit(1);
    return rows[0] !== undefined;
  }

  /** Reserve a name: the package row alone, no version (so the catalog never lists it). */
  async createPackage(name: string, scope: string | null): Promise<void> {
    await this.#db.insert(regPackages).values({ name, scope }).onConflictDoNothing();
  }

  async commitVersion({ scope, version, tag }: CommitVersionInput): Promise<void> {
    const publishedAt = Math.floor(new Date(version.publishedAt).getTime() / 1000);
    const statements: BatchItem<"sqlite">[] = [
      this.#db.insert(regPackages).values({ name: version.name, scope }).onConflictDoNothing(),
      this.#db.insert(regVersions).values({
        name: version.name,
        version: version.version,
        manifest: version.manifest,
        integrity: version.integrity,
        shasum: version.shasum,
        size: version.size,
        publishedAt,
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
    // A publish always makes its version `latest`, so reproject the search index in the same batch.
    // A non-`latest` tag (e.g. a `beta` push) leaves the listed version untouched, so skip it.
    if (tag === "latest") {
      statements.push(
        ...this.#reindexStatements(version.name, version.version, version.manifest, publishedAt),
      );
    }

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

  async setVerified(name: string, verified: boolean): Promise<void> {
    await this.#db.update(regPackages).set({ verified }).where(eq(regPackages.name, name));
  }

  /**
   * Permanently delete a package: its dist-tags, every version row, and the package row. The
   * children (`reg_versions`, `reg_dist_tags`) declare `onDelete: cascade`, but we delete them
   * explicitly (children first) so it is correct whether or not D1 enforces foreign keys. One
   * transaction-aware batch, so it lands atomically.
   */
  async deletePackage(name: string): Promise<void> {
    await this.#db.deferBatch([
      this.#db.delete(regDistTags).where(eq(regDistTags.name, name)),
      this.#db.delete(regKeywords).where(eq(regKeywords.name, name)),
      // Removing the projection row fires the FTS delete trigger, so the index drops it too.
      this.#db.delete(regSearch).where(eq(regSearch.name, name)),
      this.#db.delete(regVersions).where(eq(regVersions.name, name)),
      this.#db.delete(regPackages).where(eq(regPackages.name, name)),
    ]);
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
      .select({
        version: regVersions.version,
        manifest: regVersions.manifest,
        publishedAt: regVersions.publishedAt,
      })
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
    const top = newest[0];
    if (top === undefined) {
      // No installable version remains: drop the tag and the search projection together (the
      // `reg_search` delete cascades into the FTS index via its trigger).
      await this.#db.deferBatch([
        this.#db
          .delete(regDistTags)
          .where(and(eq(regDistTags.name, name), eq(regDistTags.tag, "latest"))),
        this.#db.delete(regKeywords).where(eq(regKeywords.name, name)),
        this.#db.delete(regSearch).where(eq(regSearch.name, name)),
      ]);
      return;
    }
    await this.#db.deferBatch([
      this.#db
        .insert(regDistTags)
        .values({ name, tag: "latest", version: top.version })
        .onConflictDoUpdate({
          target: [regDistTags.name, regDistTags.tag],
          set: { version: top.version },
        }),
      ...this.#reindexStatements(name, top.version, top.manifest, top.publishedAt),
    ]);
  }

  /**
   * Statements that reproject `name`'s search row to `version`: clear its keyword rows, upsert the
   * denormalized `reg_search` row (the FTS index follows via triggers), then re-insert its keywords.
   * `publishedAt` is in unix seconds, matching the `reg_versions` column.
   */
  #reindexStatements(
    name: string,
    version: string,
    manifest: Record<string, unknown>,
    publishedAt: number,
  ): BatchItem<"sqlite">[] {
    const fields = projectManifest(manifest);
    const row = { name, version, publishedAt, ...fields, keywords: fields.keywords.join(" ") };
    const statements: BatchItem<"sqlite">[] = [
      this.#db.delete(regKeywords).where(eq(regKeywords.name, name)),
      this.#db
        .insert(regSearch)
        .values(row)
        .onConflictDoUpdate({ target: regSearch.name, set: row }),
    ];
    if (fields.keywords.length > 0) {
      statements.push(
        this.#db.insert(regKeywords).values(fields.keywords.map((keyword) => ({ name, keyword }))),
      );
    }
    return statements;
  }
}

/** Derive the search projection's facets from a manifest: display text, deduped keywords, capability counts. */
function projectManifest(manifest: Record<string, unknown>): {
  displayName: string | null;
  description: string | null;
  keywords: string[];
  tools: number;
  blocks: number;
  bricks: number;
  sparks: number;
  pages: number;
} {
  const str = (key: string): string | null => {
    const value = manifest[key];
    return typeof value === "string" ? value : null;
  };
  const count = (key: string): number => {
    const value = manifest[key];
    return Array.isArray(value) ? value.length : 0;
  };
  const rawKeywords = Array.isArray(manifest.keywords) ? manifest.keywords : [];
  // Lowercased so tag filtering (`keyword IN (...)`) is case-insensitive, matching the backfill.
  const keywords = [
    ...new Set(
      rawKeywords
        .filter((k): k is string => typeof k === "string" && k.length > 0)
        .map((k) => k.toLowerCase()),
    ),
  ];
  return {
    displayName: str("displayName"),
    description: str("description"),
    keywords,
    tools: count("tools"),
    blocks: count("blocks"),
    bricks: count("bricks"),
    sparks: count("sparks"),
    pages: count("pages"),
  };
}
