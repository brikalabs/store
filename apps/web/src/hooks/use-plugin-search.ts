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

/** The unique authors whose id matches the query, in first-seen order. */
function collectAuthors(plugins: PluginSummary[], needle: string): AuthorHit[] {
  const seen = new Set<string>();
  const authors: AuthorHit[] = [];
  for (const plugin of plugins) {
    const author = plugin.author;
    if (author && !seen.has(author.id) && author.id.toLowerCase().includes(needle)) {
      seen.add(author.id);
      authors.push({ id: author.id, name: author.name ?? author.id, avatarUrl: author.avatarUrl });
    }
  }
  return authors;
}

/** Hit the search endpoint and shape the result; any failure yields an empty state. */
async function runSearch(q: string): Promise<SearchState> {
  try {
    const res = await fetch(`/v1/search?q=${encodeURIComponent(q)}&limit=8`);
    const json: unknown = await res.json();
    const parsed = SearchResponse.safeParse(json);
    if (!parsed.success) return EMPTY;
    return {
      plugins: parsed.data.plugins,
      authors: collectAuthors(parsed.data.plugins, q.toLowerCase()),
      loading: false,
    };
  } catch {
    return EMPTY;
  }
}

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
      void runSearch(q).then((next) => {
        if (active) setState(next);
      });
    }, 180);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  return state;
}
