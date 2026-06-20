import { PluginSummary } from "@brika/registry-contract";
import { useEffect, useState } from "react";
import { z } from "zod";

/** The `GET /api/plugins/mine` payload: the catalog plugins under the user's owned scopes. */
const MinePlugins = z.object({ plugins: z.array(PluginSummary) });

/**
 * The plugins the signed-in developer owns, from `/api/plugins/mine` - the catalog plugins
 * published under scopes they own (resolved server-side from the session, never from the
 * client). Shared by the dashboard overview (for its stats) and the My plugins table
 * so both read the same source. Returns an empty list until the request resolves.
 */
export function useMyPlugins(): PluginSummary[] {
  const [plugins, setPlugins] = useState<PluginSummary[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/api/plugins/mine")
      .then((res) => res.json())
      .then((json: unknown) => {
        const parsed = MinePlugins.safeParse(json);
        if (active && parsed.success) setPlugins(parsed.data.plugins);
      });
    return () => {
      active = false;
    };
  }, []);
  return plugins;
}
