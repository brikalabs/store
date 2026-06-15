import { type PluginSummary, SearchResponse } from "@brika/registry-contract";
import { useEffect, useState } from "react";

export interface AuthorHit {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface SearchState {
  plugins: PluginSummary[];
  authors: AuthorHit[];
  loading: boolean;
}

const EMPTY: SearchState = { plugins: [], authors: [], loading: false };

/** Debounced unified search: returns matching plugins and the authors behind them. */
export function usePluginSearch(query: string): SearchState {
  const [state, setState] = useState<SearchState>(EMPTY);

  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setState(EMPTY);
      return;
    }
    let active = true;
    setState((prev) => ({ ...prev, loading: true }));
    const handle = setTimeout(() => {
      fetch(`/v1/search?q=${encodeURIComponent(q)}&limit=8`)
        .then((res) => res.json())
        .then((json: unknown) => {
          if (!active) return;
          const parsed = SearchResponse.safeParse(json);
          if (!parsed.success) {
            setState(EMPTY);
            return;
          }
          const needle = q.toLowerCase();
          const seen = new Set<string>();
          const authors: AuthorHit[] = [];
          for (const plugin of parsed.data.plugins) {
            const author = plugin.author;
            if (author && !seen.has(author.id) && author.id.toLowerCase().includes(needle)) {
              seen.add(author.id);
              authors.push({
                id: author.id,
                name: author.name ?? author.id,
                avatarUrl: author.avatarUrl,
              });
            }
          }
          setState({ plugins: parsed.data.plugins, authors, loading: false });
        })
        .catch(() => {
          if (active) setState(EMPTY);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  return state;
}
