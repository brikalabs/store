import { useCallback, useEffect, useState } from "react";

export interface ServerPage<T> {
  readonly query: string;
  readonly setQuery: (q: string) => void;
  readonly page: number;
  readonly setPage: (p: number) => void;
  readonly items: T[];
  readonly total: number;
  readonly pages: number;
  readonly from: number;
  readonly to: number;
  readonly loading: boolean;
  readonly reload: () => void;
}

/**
 * Debounced server-side search + pagination over `GET {endpoint}?q=&limit=&offset=` (the shared
 * `Page` shape `{ items, total }`). The single source for the operator directories' search-as-you-
 * type + pager, so only the current page crosses the wire. `reload` refetches the current page.
 */
export function useServerPage<T>(endpoint: string, pageSize: number): ServerPage<T> {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: T[]; total: number } | null>(null);

  // Debounce the search box; applying the query also returns to page 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const reload = useCallback(() => {
    const params = new URLSearchParams({
      q: debounced,
      limit: String(pageSize),
      offset: String((page - 1) * pageSize),
    });
    void fetch(`${endpoint}?${params}`).then(async (res) => {
      if (res.ok) setData((await res.json()) as { items: T[]; total: number });
    });
  }, [endpoint, debounced, page, pageSize]);
  useEffect(reload, [reload]);

  const total = data?.total ?? 0;
  return {
    query,
    setQuery,
    page,
    setPage,
    items: data?.items ?? [],
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    from: total === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, total),
    loading: data === null,
    reload,
  };
}
