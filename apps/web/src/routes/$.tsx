import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { NotFoundPage } from "@/components/feedback/error-pages";
import { DETAIL_TAB_IDS, PluginDetailPage } from "@/components/plugin/detail/plugin-detail-page";
import { ScopeView } from "@/components/plugin/scope-page";
import { getPluginPage, getScopePage } from "@/lib/registry/registry";

// The active tab lives in the URL (`?tab=`) so it is deep-linkable; invalid/absent -> Overview.
const detailSearch = z.object({
  lang: z.string().optional(),
  tab: z.enum(DETAIL_TAB_IDS).optional().catch(undefined),
});

/**
 * The scope/package catch-all at the root. Every package is scoped, and a scope
 * starts with `@` (no other top-level route does), so this resolves:
 *   `/@scope`          -> the scope's package listing
 *   `/@scope/name`     -> the plugin detail page
 * Anything not starting with `@` (or an unknown scope/plugin) 404s.
 */
export const Route = createFileRoute("/$")({
  validateSearch: (input) => detailSearch.parse(input),
  loaderDeps: ({ search }) => ({ lang: search.lang }),
  loader: async ({ params, deps }) => {
    const splat = params._splat;
    if (!splat?.startsWith("@")) return null;
    // A bare scope (`@scope`, no `/name`) renders the scope's catalogue.
    if (!splat.includes("/")) {
      const scope = await getScopePage(splat);
      return scope === null ? null : { kind: "scope" as const, scope };
    }
    const page = await getPluginPage(splat, deps.lang);
    return page === null ? null : { kind: "plugin" as const, page };
  },
  component: CatchAllPage,
});

function CatchAllPage() {
  const data = Route.useLoaderData();
  if (data === null) return <NotFoundPage />;
  if (data.kind === "scope") return <ScopeView page={data.scope} />;
  return <PluginDetailPage page={data.page} />;
}
