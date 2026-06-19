import type { DownloadStats } from "./downloads";

/** One package's latest published (non-yanked, non-taken-down) version, for the listing. */
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

/**
 * Read port for the package catalog (npm has no list endpoint; this is our addition).
 * Returns every package's latest non-yanked version; filtering/pagination/stats are the
 * caller's concern.
 */
export interface CatalogReader {
  list(): Promise<CatalogEntry[]>;
}
