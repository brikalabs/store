import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "@brika/clay";
import type { PluginSummary } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Box, ChevronRight, Folder, PackageSearch, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { DiscoverIndex } from "@/components/plugin/discover-index";
import { ListingCard } from "@/components/plugin/listing-card";
import { type SortKey, SortMenu, sortPlugins } from "@/components/plugin/sort-menu";
import { formatCount } from "@/lib/format";
import { searchPlugins } from "@/lib/registry/registry";

const browseSearch = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/plugins/")({
  validateSearch: (input) => browseSearch.parse(input),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => searchPlugins(deps.q),
  component: BrowsePage,
});

type ScopeHit = { scope: string; name: string; count: number; weekly: number; verified: boolean };

/** The scopes whose name (or publisher) matches the query, top 3 by plugin count. */
function matchingScopes(plugins: PluginSummary[], query: string): ScopeHit[] {
  const needle = query.trim().toLowerCase();
  const byScope = new Map<string, ScopeHit>();
  for (const plugin of plugins) {
    const scope = scopeOf(plugin.name);
    if (scope === null) continue;
    const existing = byScope.get(scope) ?? {
      scope,
      name: plugin.author?.name ?? scope,
      count: 0,
      weekly: 0,
      verified: false,
    };
    existing.count += 1;
    existing.weekly += plugin.downloadsWeekly;
    existing.verified = existing.verified || plugin.verified;
    byScope.set(scope, existing);
  }
  return [...byScope.values()]
    .filter(
      (hit) => hit.scope.toLowerCase().includes(needle) || hit.name.toLowerCase().includes(needle),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function BrowsePage() {
  const { plugins, total } = Route.useLoaderData();
  const { q } = Route.useSearch();
  const [sort, setSort] = useState<SortKey>("relevance");

  // No query: the dense discovery index (matches the design's Console browse).
  if (!q) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-10">
        <DiscoverIndex plugins={plugins} total={total} title="Browse plugins" />
      </main>
    );
  }

  const scopes = matchingScopes(plugins, q);
  const sorted = sortPlugins(plugins, sort);
  const scopeNoun = scopes.length === 1 ? "scope" : "scopes";
  const scopeSummary = scopes.length > 0 ? `, ${scopes.length} ${scopeNoun}` : "";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-7 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Showing results for <span className="font-semibold text-foreground">"{q}"</span>
          {scopeSummary} · {total} {total === 1 ? "plugin" : "plugins"}
        </p>
        <SortMenu value={sort} onChange={setSort} />
      </div>

      {scopes.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-heading font-semibold text-muted-foreground text-sm uppercase tracking-[0.05em]">
            <Folder className="size-4" />
            Scopes
          </h2>
          <div className="flex flex-col gap-3">
            {scopes.map((hit) => (
              <Link
                key={hit.scope}
                to="/$"
                params={{ _splat: hit.scope }}
                className="group flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand"
              >
                <GradientAvatar seed={hit.scope} label={hit.name} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-heading text-foreground">{hit.name}</span>
                    {hit.verified ? <ShieldCheck className="size-4 text-brand-ink" /> : null}
                    <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-[11px] text-muted-foreground">
                      Scope
                    </span>
                  </div>
                  <div className="font-mono text-muted-foreground text-xs">{hit.scope}</div>
                </div>
                <div className="flex items-center gap-5 font-mono text-muted-foreground text-xs">
                  <span>
                    <span className="font-semibold text-foreground">{hit.count}</span>{" "}
                    {hit.count === 1 ? "plugin" : "plugins"}
                  </span>
                  {hit.weekly > 0 ? (
                    <span>
                      <span className="font-semibold text-foreground">
                        {formatCount(hit.weekly)}
                      </span>
                      <span>/wk</span>
                    </span>
                  ) : null}
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-semibold text-foreground text-sm transition-colors group-hover:border-brand group-hover:text-brand-ink">
                  View scope
                  <ChevronRight className="size-4" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {plugins.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon>
            <PackageSearch />
          </EmptyStateIcon>
          <EmptyStateTitle>No plugins found</EmptyStateTitle>
          <EmptyStateDescription>
            Try a different search, or publish one to the Brika registry.
          </EmptyStateDescription>
        </EmptyState>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-heading font-semibold text-muted-foreground text-sm uppercase tracking-[0.05em]">
            <Box className="size-4" />
            Plugins
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((plugin) => (
              <ListingCard key={plugin.name} plugin={plugin} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
