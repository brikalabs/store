import type { DownloadStats } from "./downloads";

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
  /** The scope's verified publisher (owner + display name), absent if unscoped. */
  readonly publisher?: { readonly id: string; readonly name: string; readonly verified: true };
  /** Install stats, attached by the handler per page (not by the reader). */
  readonly downloads?: DownloadStats;
}

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
 * pagination are all pushed into the search index (an FTS5 table over a denormalized projection),
 * returning one ranked page rather than the whole catalog.
 */
export interface SearchReader {
  search(options: SearchOptions): Promise<SearchResult>;
}
