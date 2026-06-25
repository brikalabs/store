import type { DownloadStats } from "./downloads";
import type { ScopePublisher } from "./types";

/** One package's latest published (non-yanked, non-taken-down) version: a search/catalog result. */
export interface CatalogEntry {
  readonly name: string;
  readonly version: string;
  /** The published package.json for the latest version. */
  readonly manifest: Record<string, unknown>;
  /** ISO-8601 publish time of the latest version. */
  readonly publishedAt: string;
  /** ISO-8601 time the package was first created. */
  readonly createdAt: string;
  readonly size: number;
  readonly integrity: string;
  /** The package's "approved by Brika" flag (operator-curated). */
  readonly verified: boolean;
  /** The owning scope as a publisher (display name + verified-organization flag), if scoped. */
  readonly publisher?: ScopePublisher;
  /** Install stats, attached by the handler per page (not by the reader). */
  readonly downloads?: DownloadStats;
}

/** A Brika capability facet: a search can require the plugin to declare at least one. */
export type SearchCapability = "tools" | "blocks" | "bricks" | "sparks" | "pages";

/** A sortable field. `relevance` needs a text query (skipped otherwise). */
export type SearchSort = "relevance" | "downloads" | "recent" | "name";

/** Result direction; absent uses the field's natural order (most/newest/best first, A→Z for name). */
export type SearchDirection = "asc" | "desc";

/** One sort term; the engine applies a list of them in order (most significant first). */
export interface SortClause {
  readonly field: SearchSort;
  readonly direction?: SearchDirection;
}

/** A search request the {@link SearchReader} resolves into one ranked, paginated page. */
export interface SearchOptions {
  /** Free-text query (FTS over name/displayName/description/keywords); absent lists everything. */
  readonly q?: string;
  /** Every keyword the plugin must carry (AND). */
  readonly tags?: readonly string[];
  /** Capabilities to filter on; a plugin matches if it declares any of them (OR). */
  readonly capabilities?: readonly SearchCapability[];
  /** Restrict to packages with this "approved by Brika" verified state; absent includes both. */
  readonly verified?: boolean;
  /** Ordered sort terms (e.g. downloads desc, then name asc); empty applies the default order. */
  readonly sort: readonly SortClause[];
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
 * pagination are all pushed into the search index (an FTS5 table over a denormalized projection),
 * returning one ranked page rather than the whole catalog.
 */
export interface SearchReader {
  search(options: SearchOptions): Promise<SearchResult>;
}
