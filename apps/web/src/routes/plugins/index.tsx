import { inject } from "@brika/di";
import { SearchCapability } from "@brika/registry-contract";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BrowsePage } from "@/components/plugin/browse-page";
import { searchPlugins } from "@/lib/registry/registry";
import { runWeb } from "@/server/injector";
import { PluginStore } from "@/server/stores/plugin-store";

const browseSearch = z.object({
  q: z.string().optional(),
  capabilities: z.array(SearchCapability).optional(),
  tags: z.array(z.string()).optional(),
  // An ordered, comma-separated `field[:dir]` list (e.g. `downloads:desc,name`); the registry validates it.
  sort: z.string().optional(),
});

// Ratings live in the store's review-derived `plugins` cache, not the registry, so they are joined in
// via a server fn: in-process during SSR, an RPC on client navigation (the loader runs in both).
const ratingsFor = createServerFn()
  .validator((names: string[]) => names)
  .handler(({ data: names }) =>
    runWeb(async () => Object.fromEntries(await inject(PluginStore).ratingSummaries(names))),
  );

export const Route = createFileRoute("/plugins/")({
  validateSearch: (input) => browseSearch.parse(input),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const result = await searchPlugins(deps.q, undefined, undefined, {
      capabilities: deps.capabilities,
      tags: deps.tags,
      sort: deps.sort,
    });
    if (result.plugins.length === 0) return result;
    const ratings = await ratingsFor({ data: result.plugins.map((plugin) => plugin.name) });
    return {
      ...result,
      plugins: result.plugins.map((plugin) => ({ ...plugin, rating: ratings[plugin.name] })),
    };
  },
  component: BrowsePage,
});
