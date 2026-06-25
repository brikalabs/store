import { type SQL, sql } from "drizzle-orm";

/**
 * Generic SQLite FTS5 helpers, independent of any one table. Pair them with a {@link SearchSource}
 * that joins the FTS5 virtual table on `rowid`: the table supplies content + the structured facets,
 * these supply the full-text predicate and relevance ordering.
 */

/**
 * Build an FTS5 `MATCH` expression from raw user text: each word becomes a quoted prefix token,
 * AND-combined (e.g. `map geo` -> `"map"* "geo"*`). Quoting turns the input into literals, so FTS
 * operators (`OR`, `NEAR`, `*`, `"`, `:`) can never be injected, and the trailing `*` gives typeahead
 * prefix matching. Returns null when the text has no word characters, which callers read as "no
 * full-text constraint".
 */
export function ftsMatch(text: string): string | null {
  const terms = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (terms === null || terms.length === 0) return null;
  return terms.map((term) => `"${term}"*`).join(" ");
}

/** A `MATCH` predicate against an FTS5 table (the caller joins it on its `rowid`). */
export function ftsMatches(ftsTable: string, match: string): SQL {
  return sql`${sql.raw(ftsTable)} MATCH ${match}`;
}

/** Relevance ordering for an FTS5 table: ascending `bm25` (more negative = better match). */
export function bm25(ftsTable: string): SQL {
  return sql`bm25(${sql.raw(ftsTable)})`;
}
