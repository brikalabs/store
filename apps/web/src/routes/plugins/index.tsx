import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BrowsePage } from "@/components/plugin/browse-page";
import { searchPlugins } from "@/lib/registry/registry";

const browseSearch = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/plugins/")({
  validateSearch: (input) => browseSearch.parse(input),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => searchPlugins(deps.q),
  component: BrowsePage,
});
