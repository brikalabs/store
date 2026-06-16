import {
  type MetadataReader,
  type PackageRecord,
  type PackageVersion,
  Provenance,
} from "@brika/registry-core";
import { type Db, regDistTags, regPackages, regVersions } from "@brika/store-db";
import { eq } from "drizzle-orm";

/** Reads package metadata from D1 and assembles the domain `PackageRecord`. */
export class D1MetadataReader implements MetadataReader {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async getPackage(name: string): Promise<PackageRecord | null> {
    const packageRows = await this.#db
      .select()
      .from(regPackages)
      .where(eq(regPackages.name, name))
      .limit(1);
    const pkg = packageRows[0];
    if (pkg === undefined) return null;

    const [versionRows, tagRows] = await Promise.all([
      this.#db.select().from(regVersions).where(eq(regVersions.name, name)),
      this.#db.select().from(regDistTags).where(eq(regDistTags.name, name)),
    ]);

    const distTags: Record<string, string> = {};
    for (const row of tagRows) distTags[row.tag] = row.version;

    const versions: PackageVersion[] = versionRows.map((row) => ({
      name: row.name,
      version: row.version,
      manifest: row.manifest,
      integrity: row.integrity,
      shasum: row.shasum,
      size: row.size,
      publishedAt: new Date(row.publishedAt * 1000).toISOString(),
      deprecated: row.deprecated,
      yanked: row.yanked,
      provenance: Provenance.nullable()
        .catch(null)
        .parse(row.provenance ?? null),
    }));

    return {
      name: pkg.name,
      distTags,
      versions,
      createdAt: new Date(pkg.createdAt * 1000).toISOString(),
    };
  }
}
