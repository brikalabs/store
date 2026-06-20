import {
  type MetadataReader,
  type PackageRecord,
  type PackageVersion,
  Provenance,
  type ScopePublisher,
} from "@brika/registry-core";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { regDistTags, regOrgs, regPackages, regScopes, regVersions } from "../schema";

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

    const [versionRows, tagRows, orgRows] = await Promise.all([
      this.#db.select().from(regVersions).where(eq(regVersions.name, name)),
      this.#db.select().from(regDistTags).where(eq(regDistTags.name, name)),
      pkg.scope === null
        ? Promise.resolve([])
        : this.#db
            .select({ slug: regOrgs.slug, displayName: regOrgs.displayName })
            .from(regScopes)
            .innerJoin(regOrgs, eq(regOrgs.slug, regScopes.orgId))
            .where(eq(regScopes.scope, pkg.scope))
            .limit(1),
    ]);

    const distTags: Record<string, string> = {};
    for (const row of tagRows) distTags[row.tag] = row.version;

    const org = orgRows[0];
    const publisher: ScopePublisher | null =
      org === undefined ? null : { id: org.slug, name: org.displayName ?? org.slug };

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
      takedownReason: row.takedown,
      provenance: Provenance.nullable()
        .catch(null)
        .parse(row.provenance ?? null),
    }));

    return {
      name: pkg.name,
      distTags,
      versions,
      publisher,
      createdAt: new Date(pkg.createdAt * 1000).toISOString(),
    };
  }
}
