import { useCallback, useEffect, useState } from "react";
import type { Paginated } from "@/lib/pagination";

/**
 * ponytail: the operator console is an internal, low-volume moderation surface, so it loads one
 * capped window and does facet/sort/selection client-side (the design mock works the same way).
 * Capped at the registry contract's max page size (`PageQuery` allows limit <= 100); beyond that the
 * operator searches to narrow. If a registry ever outgrows this, push facet + sort down to SQL.
 */
const WINDOW = 100;

export interface OperatorList<T> {
  readonly query: string;
  readonly setQuery: (q: string) => void;
  readonly items: T[];
  readonly total: number;
  readonly loading: boolean;
  /** True when the registry has more rows than the loaded window (search to narrow). */
  readonly capped: boolean;
  readonly reload: () => void;
}

/**
 * Debounced server search over `GET {endpoint}?q=&limit=&offset=`, returning one capped window the
 * operator screens filter and sort in memory. `reload` refetches after a moderation action.
 */
export function useOperatorList<T>(endpoint: string): OperatorList<T> {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [data, setData] = useState<Paginated<T> | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const reload = useCallback(() => {
    const params = new URLSearchParams({ q: debounced, limit: String(WINDOW), offset: "0" });
    void fetch(`${endpoint}?${params}`).then(async (res) => {
      if (res.ok) setData((await res.json()) as Paginated<T>);
    });
  }, [endpoint, debounced]);
  useEffect(reload, [reload]);

  const items = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  return {
    query,
    setQuery,
    items,
    total,
    loading: data === null,
    capped: total > items.length,
    reload,
  };
}
