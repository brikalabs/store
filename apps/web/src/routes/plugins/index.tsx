import { SearchCapability } from "@brika/registry-contract";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BrowsePage } from "@/components/plugin/browse-page";
import { searchPlugins } from "@/lib/registry/registry";

const browseSearch = z.object({
  q: z.string().optional(),
  capabilities: z.array(SearchCapability).optional(),
  tags: z.array(z.string()).optional(),
  // An ordered, comma-separated `field[:dir]` list (e.g. `downloads:desc,name`); the registry validates it.
  sort: z.string().optional(),
});

export const Route = createFileRoute("/plugins/")({
  validateSearch: (input) => browseSearch.parse(input),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    searchPlugins(deps.q, undefined, undefined, {
      capabilities: deps.capabilities,
      tags: deps.tags,
      sort: deps.sort,
    }),
  component: BrowsePage,
});
