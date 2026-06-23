/**
 * A generic, transport-agnostic pagination contract shared by every list read. `Pageable` is the
 * request window (offset-based, matching the registry's `?limit=&offset=` HTTP surface); `Page<T>`
 * is the response: just the window's items plus the total so a caller can render "x-y of z" and
 * decide whether to fetch more. Readers return a `Page` instead of a full array, so the wire (and
 * the client) never carries the whole list.
 */
export interface Pageable {
  /** Maximum items to return. */
  readonly limit: number;
  /** Items to skip from the start of the (filtered) list. */
  readonly offset: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  /** Total matching items across all pages (not just this window). */
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Slice an already-materialized array into a `Page`. For bounded reads that load their (small)
 * result set and page in memory; a store that can push `LIMIT`/`OFFSET` down should build the
 * `Page` directly from a windowed query + a `COUNT` instead.
 */
export function paginate<T>(all: readonly T[], { limit, offset }: Pageable): Page<T> {
  return { items: all.slice(offset, offset + limit), total: all.length, limit, offset };
}

/** An empty page for the given window (e.g. an unreachable read that degrades gracefully). */
export function emptyPage<T>({ limit, offset }: Pageable): Page<T> {
  return { items: [], total: 0, limit, offset };
}

/** Whether more items exist after this page. */
export function hasMore<T>(page: Page<T>): boolean {
  return page.offset + page.items.length < page.total;
}
