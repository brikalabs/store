import { SearchCapability } from "@brika/registry-contract";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BrowsePage, PAGE_SIZE } from "@/components/plugin/browse-page";
import { searchPlugins } from "@/lib/registry/registry";
import { withRatings } from "@/server/with-ratings";

// The Trending + Popular-spaces rails aggregate over the whole (bounded) catalog, independent of the
// grid's page/sort, so one capped scan feeds them.
const RAILS_SCAN = 200;

const browseSearch = z.object({
  q: z.string().optional(),
  capabilities: z.array(SearchCapability).optional(),
  tags: z.array(z.string()).optional(),
  // An ordered, comma-separated `field[:dir]` list (e.g. `downloads:desc,name`); the registry validates it.
  sort: z.string().optional(),
  /** The "verified only" toggle state; absent defaults to on for Explore, off for a search. */
  verified: z.boolean().optional(),
  offset: z.number().optional(),
});

export const Route = createFileRoute("/plugins/")({
  validateSearch: (input) => browseSearch.parse(input),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const explore = !deps.q && !deps.capabilities?.length && !deps.tags?.length;
    const verifiedOnly = deps.verified ?? explore;
    const filters = {
      capabilities: deps.capabilities,
      tags: deps.tags,
      sort: deps.sort,
      verified: verifiedOnly ? true : undefined,
    };
    const page = await searchPlugins(deps.q, PAGE_SIZE, deps.offset ?? 0, filters).then(
      withRatings,
    );
    // The discovery rails only exist on the unfiltered Explore view.
    const railsPlugins = explore
      ? (await searchPlugins(undefined, RAILS_SCAN, 0, { verified: filters.verified })).plugins
      : [];
    return { ...page, railsPlugins, verifiedOnly };
  },
  component: BrowsePage,
});
