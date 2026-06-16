import type { MetadataWriter, PackageVersion, VersionManager } from "@brika/registry-core";
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

  async ensurePackage(name: string, scope: string | null): Promise<void> {
    await this.#db.insert(regPackages).values({ name, scope }).onConflictDoNothing();
  }

  async insertVersion(version: PackageVersion): Promise<void> {
    await this.#db.insert(regVersions).values({
      name: version.name,
      version: version.version,
      manifest: version.manifest,
      integrity: version.integrity,
      shasum: version.shasum,
      size: version.size,
      publishedAt: Math.floor(new Date(version.publishedAt).getTime() / 1000),
      deprecated: version.deprecated,
      yanked: version.yanked,
    });
  }

  async setDistTag(name: string, tag: string, version: string): Promise<void> {
    await this.#db
      .insert(regDistTags)
      .values({ name, tag, version })
      .onConflictDoUpdate({ target: [regDistTags.name, regDistTags.tag], set: { version } });
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
}
