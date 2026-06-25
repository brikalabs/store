import { inject } from "@brika/di";
import type { SearchResponse } from "@brika/registry-contract";
import { createServerFn } from "@tanstack/react-start";
import { runWeb } from "@/server/injector";
import { PluginStore } from "@/server/stores/plugin-store";

// Ratings live in the store's review-derived `plugins` cache, not the registry, so they are joined in
// via a server fn: in-process during SSR, an RPC on client navigation (loaders run in both).
const ratingsFor = createServerFn()
  .validator((names: string[]) => names)
  .handler(({ data: names }) =>
    runWeb(async () => Object.fromEntries(await inject(PluginStore).ratingSummaries(names))),
  );

/** Attach store ratings to a registry search result (the registry returns none of its own). */
export async function withRatings(result: SearchResponse): Promise<SearchResponse> {
  if (result.plugins.length === 0) return result;
  const ratings = await ratingsFor({ data: result.plugins.map((plugin) => plugin.name) });
  return {
    ...result,
    plugins: result.plugins.map((plugin) => ({ ...plugin, rating: ratings[plugin.name] })),
  };
}
