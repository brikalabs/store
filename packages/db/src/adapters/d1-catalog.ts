import { inject } from "@brika/di";
import type { CatalogEntry, CatalogReader } from "@brika/registry-core";
import { and, eq } from "drizzle-orm";
import { Db } from "../client";
import { regDistTags, regPackages, regScopes, regVersions } from "../schema";

/**
 * D1 {@link CatalogReader}: every package's latest non-yanked, non-taken-down version with its
 * scope as verified publisher. The hosted scope is bounded, so filtering in memory is cheap and exact.
 */
export class D1CatalogReader implements CatalogReader {
  readonly #db = inject(Db);

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
        scope: regScopes.scope,
        scopeDisplayName: regScopes.displayName,
      })
      .from(regDistTags)
      .innerJoin(
        regVersions,
        and(eq(regVersions.name, regDistTags.name), eq(regVersions.version, regDistTags.version)),
      )
      .innerJoin(regPackages, eq(regPackages.name, regDistTags.name))
      .leftJoin(regScopes, eq(regScopes.scope, regPackages.scope))
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
          row.scope === null
            ? undefined
            : {
                id: row.scope,
                name: row.scopeDisplayName ?? row.scope,
                verified: true as const,
              },
      }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }
}
