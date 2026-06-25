import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { HomePage } from "@/components/home/home-page";
import { searchPlugins } from "@/lib/registry/registry";
import { withRatings } from "@/server/with-ratings";

const homeSearch = z.object({ d: z.enum(["a", "b"]).optional() });

export const Route = createFileRoute("/")({
  validateSearch: (input) => homeSearch.parse(input),
  loader: () => searchPlugins(undefined, 18).then(withRatings),
  component: HomePage,
});
