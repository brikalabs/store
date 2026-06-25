import type { CatalogEntry } from "./catalog";

/** A Brika capability facet: a search can require the plugin to declare at least one. */
export type SearchCapability = "tools" | "blocks" | "bricks" | "sparks" | "pages";

/** Server-side result orders. `relevance` needs a text query (the reader falls back to `recent`). */
export type SearchSort = "relevance" | "downloads" | "recent" | "name";

/** A search request the {@link SearchReader} resolves into one ranked, paginated page. */
export interface SearchOptions {
  /** Free-text query (FTS over name/displayName/description/keywords); absent lists everything. */
  readonly q?: string;
  /** Every keyword the plugin must carry (AND). */
  readonly tags?: readonly string[];
  /** Capability the plugin must declare at least one of. */
  readonly capability?: SearchCapability;
  readonly sort: SearchSort;
  readonly limit: number;
  readonly offset: number;
}

/** One page of catalog entries plus the total across all pages (for pagination). */
export interface SearchResult {
  readonly entries: CatalogEntry[];
  readonly total: number;
}

/**
 * Read port that searches the catalog: a full-text query, tag/capability filters, sort and
 * pagination are pushed into the search index (an FTS5 table over a denormalized projection),
 * unlike {@link CatalogReader} which returns the whole bounded catalog for the caller to slice.
 */
export interface SearchReader {
  search(options: SearchOptions): Promise<SearchResult>;
}
