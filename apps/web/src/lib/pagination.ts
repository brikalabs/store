/**
 * The one pagination shape shared by the backend, the {@link Pager} component, and the list hooks.
 * Endpoints return `{ items, pagination }` (via {@link paginated}); a client-paged list builds the
 * same object from an in-memory slice. So `<Pager pagination={...} onPageChange={...} />` is the only
 * wiring a caller ever writes - no hand-computed `pages`/`from`/`to`.
 */
export interface Pagination {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** 1-based index of the first row on this page (0 when empty). */
  from: number;
  /** 1-based index of the last row on this page. */
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/** The standard list response envelope: the page of rows plus its pagination metadata. */
export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

/** Derive the full pagination metadata from a total and the requested `{ limit, offset }` window. */
export function paginate(total: number, window: { limit: number; offset: number }): Pagination {
  const pageSize = Math.max(1, window.limit);
  const offset = Math.max(0, window.offset);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.floor(offset / pageSize) + 1);
  return {
    page,
    pageSize,
    total,
    totalPages,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, total),
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

/** Wrap a page of rows into the `{ items, pagination }` envelope an endpoint returns. */
export function paginated<T>(
  items: T[],
  total: number,
  window: { limit: number; offset: number },
): Paginated<T> {
  return { items, pagination: paginate(total, window) };
}
