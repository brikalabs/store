import { PluginSummary } from "@brika/registry-contract";
import { useEffect, useState } from "react";
import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";

/** The `GET /api/plugins/mine` payload: the catalog plugins under the user's owned scopes. */
const MinePlugins = z.object({ plugins: z.array(PluginSummary) });

/**
 * The plugins the signed-in developer owns, from `/api/plugins/mine` - resolved server-side from
 * the session, never from the client. Returns an empty list until the request resolves.
 */
export function useMyPlugins(): PluginSummary[] {
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  useEffect(() => {
    let active = true;
    fetchJson("/api/plugins/mine", MinePlugins).then((data) => {
      if (active && data) setPlugins(data.plugins);
    });
    return () => {
      active = false;
    };
  }, []);
  return plugins;
}
