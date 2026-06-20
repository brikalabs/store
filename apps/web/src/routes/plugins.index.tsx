import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "@brika/clay";
import type { PluginSummary } from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Box, ChevronRight, PackageSearch, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { DiscoverIndex } from "@/components/discover-index";
import { PluginCard } from "@/components/plugin-card";
import { type SortKey, SortMenu, sortPlugins } from "@/components/sort-menu";
import { formatCount } from "@/lib/format";
import { searchPlugins } from "@/lib/registry";

const browseSearch = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/plugins/")({
  validateSearch: (input) => browseSearch.parse(input),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => searchPlugins(deps.q),
  component: BrowsePage,
});

type Author = { id: string; name: string; count: number; weekly: number; verified: boolean };

function matchingAuthors(plugins: PluginSummary[], query: string): Author[] {
  const needle = query.trim().toLowerCase();
  const byId = new Map<string, Author>();
  for (const plugin of plugins) {
    if (!plugin.author) continue;
    const existing = byId.get(plugin.author.id) ?? {
      id: plugin.author.id,
      name: plugin.author.name ?? plugin.author.id,
      count: 0,
      weekly: 0,
      verified: false,
    };
    existing.count += 1;
    existing.weekly += plugin.downloadsWeekly;
    existing.verified = existing.verified || plugin.verified;
    byId.set(plugin.author.id, existing);
  }
  return [...byId.values()]
    .filter(
      (author) =>
        author.id.toLowerCase().includes(needle) || author.name.toLowerCase().includes(needle),
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

  const authors = matchingAuthors(plugins, q);
  const sorted = sortPlugins(plugins, sort);
  const authorNoun = authors.length === 1 ? "author" : "authors";
  const authorSummary = authors.length > 0 ? `, ${authors.length} ${authorNoun}` : "";

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-7 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Showing results for <span className="font-semibold text-foreground">"{q}"</span>
          {authorSummary} · {total} {total === 1 ? "plugin" : "plugins"}
        </p>
        <SortMenu value={sort} onChange={setSort} />
      </div>

      {authors.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-heading font-semibold text-muted-foreground text-sm uppercase tracking-[0.05em]">
            <Users className="size-4" />
            Authors
          </h2>
          <div className="flex flex-col gap-3">
            {authors.map((author) => (
              <Link
                key={author.id}
                to="/developers/$id"
                params={{ id: author.id }}
                className="group flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-brand"
              >
                <GradientAvatar seed={author.id} label={author.name} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-heading text-foreground">{author.name}</span>
                    {author.verified ? <ShieldCheck className="size-4 text-brand-ink" /> : null}
                    <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-[11px] text-muted-foreground">
                      Author
                    </span>
                  </div>
                  <div className="font-mono text-muted-foreground text-xs">@{author.id}</div>
                </div>
                <div className="flex items-center gap-5 font-mono text-muted-foreground text-xs">
                  <span>
                    <span className="font-semibold text-foreground">{author.count}</span>{" "}
                    {author.count === 1 ? "plugin" : "plugins"}
                  </span>
                  {author.weekly > 0 ? (
                    <span>
                      <span className="font-semibold text-foreground">
                        {formatCount(author.weekly)}
                      </span>
                      <span>/wk</span>
                    </span>
                  ) : null}
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-semibold text-foreground text-sm transition-colors group-hover:border-brand group-hover:text-brand-ink">
                  View profile
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
            Try a different search, or publish one to npm with the <code>brika</code> keyword.
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
              <PluginCard key={plugin.name} plugin={plugin} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
