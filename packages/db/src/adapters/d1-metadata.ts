import { inject } from "@brika/di";
import {
  type MetadataReader,
  type PackageRecord,
  type PackageVersion,
  Provenance,
  scopePublisher,
} from "@brika/registry-core";
import { eq } from "drizzle-orm";
import { Db } from "../client";
import { regDistTags, regPackages, regScopes, regVersions } from "../schema";

/** Reads package metadata from D1 and assembles the domain `PackageRecord`. */
export class D1MetadataReader implements MetadataReader {
  readonly #db = inject(Db);

  async getPackage(name: string): Promise<PackageRecord | null> {
    const packageRows = await this.#db
      .select()
      .from(regPackages)
      .where(eq(regPackages.name, name))
      .limit(1);
    const pkg = packageRows[0];
    if (pkg === undefined) return null;

    const [versionRows, tagRows, scopeRows] = await Promise.all([
      this.#db.select().from(regVersions).where(eq(regVersions.name, name)),
      this.#db.select().from(regDistTags).where(eq(regDistTags.name, name)),
      pkg.scope === null
        ? Promise.resolve([])
        : this.#db
            .select({
              scope: regScopes.scope,
              displayName: regScopes.displayName,
              takedown: regScopes.takedown,
              verified: regScopes.verified,
            })
            .from(regScopes)
            .where(eq(regScopes.scope, pkg.scope))
            .limit(1),
    ]);

    const distTags: Record<string, string> = {};
    for (const row of tagRows) distTags[row.tag] = row.version;

    const scope = scopeRows[0];
    const publisher =
      scope === undefined ? null : scopePublisher(scope.scope, scope.displayName, scope.verified);

    const versions: PackageVersion[] = versionRows.map((row) => ({
      name: row.name,
      version: row.version,
      manifest: row.manifest,
      integrity: row.integrity,
      shasum: row.shasum,
      size: row.size,
      publishedAt: row.publishedAt,
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
      verified: pkg.verified,
      takedown: pkg.takedown,
      scopeTakedown: scope?.takedown ?? null,
      createdAt: pkg.createdAt,
    };
  }
}
