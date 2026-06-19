import type { CommitVersionInput, MetadataWriter, VersionManager } from "@brika/registry-core";
import { type Db, regDistTags, regPackages, regVersions } from "@brika/store-db";
import { and, eq } from "drizzle-orm";

/**
 * Persists a published version to D1 and mutates its management flags. Covers
 * both the publish writer (`MetadataWriter`) and the post-publish manager
 * (`VersionManager`) since they share the same `reg_versions` table.
 */
export class D1MetadataWriter implements MetadataWriter, VersionManager {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
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
      // A duplicate version is a unique-constraint violation here, so a TOCTOU race
      // past `versionExists` fails the whole batch (and the caller rolls the tarball
      // back) rather than corrupting an existing version.
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
    ] as const;

    // D1 runs a batch atomically; the bun:sqlite client used in tests has no
    // `batch`, so fall back to sequential execution there (real atomicity is
    // verified against D1).
    if (typeof this.#db.batch === "function") {
      await this.#db.batch(statements);
    } else {
      for (const statement of statements) await statement;
    }
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
