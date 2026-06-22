import { type PluginSummary, SearchResponse } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";

export interface ScopeHit {
  scope: string;
  name: string;
}

interface SearchState {
  plugins: PluginSummary[];
  scopes: ScopeHit[];
  loading: boolean;
}

const EMPTY: SearchState = { plugins: [], scopes: [], loading: false };

/** The unique scopes whose scope (or publisher name) matches the query, in first-seen order. */
function collectScopes(plugins: PluginSummary[], needle: string): ScopeHit[] {
  const seen = new Set<string>();
  const scopes: ScopeHit[] = [];
  for (const plugin of plugins) {
    const scope = scopeOf(plugin.name);
    if (scope === null || seen.has(scope)) continue;
    const name = plugin.author?.name ?? scope;
    if (scope.toLowerCase().includes(needle) || name.toLowerCase().includes(needle)) {
      seen.add(scope);
      scopes.push({ scope, name });
    }
  }
  return scopes;
}

/** Hit the search endpoint and shape the result; any failure yields an empty state. */
async function runSearch(q: string): Promise<SearchState> {
  const data = await fetchJson(`/v1/search?q=${encodeURIComponent(q)}&limit=8`, SearchResponse);
  if (data === null) return EMPTY;
  return {
    plugins: data.plugins,
    scopes: collectScopes(data.plugins, q.toLowerCase()),
    loading: false,
  };
}

/** Debounced unified search: returns matching plugins and the scopes behind them. */
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
