import { and, type SQL } from "drizzle-orm";

/**
 * A small, table-agnostic search engine. An entity becomes searchable by implementing
 * {@link SearchSource} (its own typed `count`/`page` queries) and handing {@link runSearch} a list
 * of predicates and an ordering; the engine owns the universal parts: composing the `WHERE`, the
 * empty short-circuit, and offset pagination. It is storage-shaped, not FTS-specific, so the same
 * engine drives a plain filtered list or a full-text search (see {@link ./fts}).
 */

/** An offset-pagination window. */
export interface Pageable {
  readonly limit: number;
  readonly offset: number;
}

/** One page of results plus the total across all pages (for the pager). */
export interface SearchPage<T> {
  readonly entries: T[];
  readonly total: number;
}

/**
 * The storage half of a searchable entity: count the rows matching `where`, and read one ordered,
 * hydrated page of them. Implementations keep their Drizzle queries fully typed; {@link runSearch}
 * layers the generic orchestration on top, so the same `where` drives both the count and the page.
 */
export interface SearchSource<T> {
  count(where: SQL | undefined): Promise<number>;
  page(where: SQL | undefined, order: readonly SQL[], page: Pageable): Promise<T[]>;
}

/**
 * Run a search over a {@link SearchSource}: AND the active predicates into a `WHERE`, count the
 * matches, and (unless empty) read the requested ordered page. Null/undefined predicates are
 * dropped, so a caller can pass `cond ? predicate : null` inline without pre-filtering.
 */
export async function runSearch<T>(
  source: SearchSource<T>,
  predicates: ReadonlyArray<SQL | null | undefined>,
  order: readonly SQL[],
  page: Pageable,
): Promise<SearchPage<T>> {
  const active = predicates.filter((predicate): predicate is SQL => predicate != null);
  const where = active.length > 0 ? and(...active) : undefined;
  const total = await source.count(where);
  if (total === 0) return { entries: [], total: 0 };
  return { entries: await source.page(where, order, page), total };
}
