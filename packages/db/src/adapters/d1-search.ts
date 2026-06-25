import { inject } from "@brika/di";
import type { CatalogEntry, SearchOptions, SearchReader, SearchResult } from "@brika/registry-core";
import { and, count, desc, eq, gt, inArray, type SQL, sql } from "drizzle-orm";
import { integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { Db } from "../client";
import {
  regDownloads,
  regKeywords,
  regPackages,
  regScopes,
  regSearch,
  regVersions,
} from "../schema";
import { type Pageable, runSearch, type SearchSource } from "../search/engine";
import { bm25, ftsMatch, ftsMatches } from "../search/fts";

// The FTS5 index over reg_search (a virtual table created in the migration, not part of the Drizzle
// schema). A minimal handle + rowid linkage so every query can join it; it is always inner-joined
// (one FTS row per projection row), so without a MATCH it simply passes every package through.
const FTS = "reg_search_fts";
const regSearchFts = sqliteTable(FTS, { rowid: integer("rowid") });
const ftsOnRowid = sql`${sql.raw(FTS)}.rowid = reg_search.rowid`;

/**
 * D1 search over the `reg_search` projection + its `reg_search_fts` index (both maintained by
 * {@link D1MetadataWriter}). It is the {@link SearchSource} for the catalog: the generic engine
 * composes the filters and paginates, while this owns the typed Drizzle queries and returns the
 * matched `reg_versions.manifest` verbatim, so callers map it exactly as the plain catalog does.
 */
export class D1SearchReader implements SearchReader, SearchSource<CatalogEntry> {
  readonly #db = inject(Db);

  search(options: SearchOptions): Promise<SearchResult> {
    const match = options.q ? ftsMatch(options.q) : null;
    return runSearch(
      this,
      [
        match !== null ? ftsMatches(FTS, match) : null,
        tagsFilter(this.#db, options.tags),
        options.capability ? gt(regSearch[options.capability], 0) : null,
      ],
      orderFor(options.sort, match !== null),
      options,
    );
  }

  async count(where: SQL | undefined): Promise<number> {
    const rows = await this.#db
      .select({ value: count() })
      .from(regSearch)
      .innerJoin(regSearchFts, ftsOnRowid)
      .where(where);
    return rows[0]?.value ?? 0;
  }

  async page(
    where: SQL | undefined,
    order: readonly SQL[],
    page: Pageable,
  ): Promise<CatalogEntry[]> {
    const rows = await this.#db
      .select({
        name: regSearch.name,
        version: regSearch.version,
        manifest: regVersions.manifest,
        publishedAt: regVersions.publishedAt,
        createdAt: regPackages.createdAt,
        size: regVersions.size,
        integrity: regVersions.integrity,
        scope: regPackages.scope,
        scopeDisplayName: regScopes.displayName,
      })
      .from(regSearch)
      .innerJoin(regSearchFts, ftsOnRowid)
      .innerJoin(
        regVersions,
        and(eq(regVersions.name, regSearch.name), eq(regVersions.version, regSearch.version)),
      )
      .innerJoin(regPackages, eq(regPackages.name, regSearch.name))
      .leftJoin(regScopes, eq(regScopes.scope, regPackages.scope))
      .where(where)
      .orderBy(...order)
      .limit(page.limit)
      .offset(page.offset);
    return rows.map(toEntry);
  }
}

/** Require the package to carry every requested keyword (lowercased, since the index stores them so). */
function tagsFilter(db: Db, tags: readonly string[] | undefined): SQL | null {
  if (tags === undefined || tags.length === 0) return null;
  const owners = db
    .select({ name: regKeywords.name })
    .from(regKeywords)
    .where(
      inArray(
        regKeywords.keyword,
        tags.map((tag) => tag.toLowerCase()),
      ),
    )
    .groupBy(regKeywords.name)
    .having(sql`count(distinct ${regKeywords.keyword}) = ${tags.length}`);
  return inArray(regSearch.name, owners);
}

/** All-time install count, as a correlated subquery, so the `downloads` sort needs no extra join. */
const downloadsTotal = sql`(select coalesce(sum(${regDownloads.count}), 0) from ${regDownloads} where ${regDownloads.name} = ${regSearch.name})`;

function orderFor(sort: SearchOptions["sort"], hasQuery: boolean): SQL[] {
  switch (sort) {
    case "relevance":
      return hasQuery
        ? [bm25(FTS), desc(regVersions.publishedAt)]
        : [desc(regVersions.publishedAt)];
    case "downloads":
      return [desc(downloadsTotal), desc(regVersions.publishedAt)];
    case "name":
      return [sql`coalesce(${regSearch.displayName}, ${regSearch.name}) collate nocase`];
    default:
      return [desc(regVersions.publishedAt)];
  }
}

interface Row {
  readonly name: string;
  readonly version: string;
  readonly manifest: Record<string, unknown>;
  readonly publishedAt: number;
  readonly createdAt: number;
  readonly size: number;
  readonly integrity: string;
  readonly scope: string | null;
  readonly scopeDisplayName: string | null;
}

function toEntry(row: Row): CatalogEntry {
  return {
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
        : { id: row.scope, name: row.scopeDisplayName ?? row.scope, verified: true as const },
  };
}
