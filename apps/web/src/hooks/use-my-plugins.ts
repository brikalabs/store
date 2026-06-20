import { type PluginSummary, SearchResponse } from "@brika/registry-contract";
import { useEffect, useState } from "react";

/**
 * The plugins the signed-in developer maintains, from the `/v1/search` maintainer query.
 * Shared by the dashboard overview (for its stats) and the My plugins table so both read
 * the same source. Returns an empty list until the request resolves.
 */
export function useMyPlugins(login: string): PluginSummary[] {
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  useEffect(() => {
    let active = true;
    const query = encodeURIComponent(`maintainer:${login}`);
    fetch(`/v1/search?q=${query}&limit=50`)
      .then((res) => res.json())
      .then((json: unknown) => {
        const parsed = SearchResponse.safeParse(json);
        if (active && parsed.success) setPlugins(parsed.data.plugins);
      });
    return () => {
      active = false;
    };
  }, [login]);
  return plugins;
}
