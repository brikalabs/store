import type { CatalogEntry, CatalogReader } from "@brika/registry-core";
import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { regDistTags, regOrgs, regPackages, regScopes, regVersions } from "../schema";

/**
 * Cloudflare D1 implementation of the {@link CatalogReader} port: every package's latest
 * non-yanked, non-taken-down version, joined with its scope's owning org as the verified
 * publisher. The hosted scope is bounded (REGISTRY_LIMITS.maxPackagesPerScope), so reading
 * every latest row and letting the caller filter/paginate in memory is cheap and exact.
 */
export class D1CatalogReader implements CatalogReader {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async list(): Promise<CatalogEntry[]> {
    const rows = await this.#db
      .select({
        name: regDistTags.name,
        version: regDistTags.version,
        manifest: regVersions.manifest,
        publishedAt: regVersions.publishedAt,
        createdAt: regPackages.createdAt,
        size: regVersions.size,
        integrity: regVersions.integrity,
        yanked: regVersions.yanked,
        takedown: regVersions.takedown,
        orgSlug: regOrgs.slug,
        orgDisplayName: regOrgs.displayName,
      })
      .from(regDistTags)
      .innerJoin(
        regVersions,
        and(eq(regVersions.name, regDistTags.name), eq(regVersions.version, regDistTags.version)),
      )
      .innerJoin(regPackages, eq(regPackages.name, regDistTags.name))
      .leftJoin(regScopes, eq(regScopes.scope, regPackages.scope))
      .leftJoin(regOrgs, eq(regOrgs.slug, regScopes.orgId))
      .where(eq(regDistTags.tag, "latest"));

    return rows
      .filter((row) => !row.yanked && row.takedown === null)
      .map((row) => ({
        name: row.name,
        version: row.version,
        manifest: row.manifest,
        publishedAt: new Date(row.publishedAt * 1000).toISOString(),
        createdAt: new Date(row.createdAt * 1000).toISOString(),
        size: row.size,
        integrity: row.integrity,
        publisher:
          row.orgSlug === null
            ? undefined
            : {
                id: row.orgSlug,
                name: row.orgDisplayName ?? row.orgSlug,
                verified: true as const,
              },
      }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }
}
