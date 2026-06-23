import { PluginSummary, pageSchema } from "@brika/registry-contract";
import { useEffect, useState } from "react";
import { z } from "zod";

/**
 * The signed-in developer's owned plugins from `GET /api/plugins/mine` - a single *page* of
 * results (filtered server-side by `q`/`status`/`scope`), plus aggregates computed over the full
 * owned set: `stats` for the overview cards and `scopes` facet counts for the filter chips. The
 * client never receives the whole list; the overview reads `stats`, the My-plugins table drives the
 * window. Re-fetches whenever a param changes.
 */
const OwnedPlugins = z.object({
  page: pageSchema(PluginSummary),
  scopes: z.array(z.object({ scope: z.string(), name: z.string(), count: z.number() })),
  stats: z.object({
    total: z.number(),
    weeklyDownloads: z.number(),
    avgRating: z.number(),
    verified: z.number(),
  }),
});
export type OwnedPlugins = z.infer<typeof OwnedPlugins>;

export type OwnedPluginsParams = {
  q?: string;
  status?: string;
  scope?: string | null;
  limit?: number;
  offset?: number;
};

export function useOwnedPlugins(params: OwnedPluginsParams): {
  data: OwnedPlugins | null;
  loading: boolean;
} {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.scope) search.set("scope", params.scope);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const key = search.toString();

  const [data, setData] = useState<OwnedPlugins | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/plugins/mine?${key}`)
      .then((res) => res.json())
      .then((json: unknown) => {
        const parsed = OwnedPlugins.safeParse(json);
        if (active && parsed.success) setData(parsed.data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key]);

  return { data, loading };
}
