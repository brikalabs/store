import type { PluginSummary } from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Search, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import { gradientCss } from "@/components/clay/gradients";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { Segmented, segmentClassName } from "@/components/clay/segmented";
import { CAPABILITY_TILES, DiscoverIndex } from "@/components/discover-index";
import { PluginCard } from "@/components/plugin-card";
import { useSearch } from "@/components/search-context";
import { searchPlugins } from "@/lib/registry";

const homeSearch = z.object({ d: z.enum(["a", "b"]).optional() });

export const Route = createFileRoute("/")({
  validateSearch: (input) => homeSearch.parse(input),
  loader: () => searchPlugins(undefined, 18),
  component: Home,
});

function Home() {
  const { plugins, total } = Route.useLoaderData();
  const { d } = Route.useSearch();
  const direction = d ?? "a";

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 pt-7">
        <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.07em]">
          Direction
        </span>
        <Segmented>
          <Link to="/" search={{ d: "a" }} className={segmentClassName(direction === "a")}>
            Spotlight
          </Link>
          <Link to="/" search={{ d: "b" }} className={segmentClassName(direction === "b")}>
            Console
          </Link>
        </Segmented>
      </div>
      {direction === "b" ? (
        <DirectionConsole plugins={plugins} total={total} />
      ) : (
        <DirectionSpotlight plugins={plugins} total={total} />
      )}
    </div>
  );
}

type DirectionProps = Readonly<{ plugins: PluginSummary[]; total: number }>;

function DirectionSpotlight({ plugins, total }: DirectionProps) {
  const { focusSearch } = useSearch();
  const hero = plugins[0];
  const featured = plugins.slice(0, 4);
  const trending = plugins.slice(4, 8);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-14 px-6 py-10">
      <section className="hero-surface relative overflow-hidden rounded-[26px] border border-brand/25 p-8 shadow-sm sm:p-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 font-semibold text-brand-ink text-xs">
              <Sparkles className="size-3.5" />
              {total} plugins and counting
            </span>
            <h1 className="text-balance font-bold font-heading text-5xl leading-[1.02] tracking-tight sm:text-6xl">
              The marketplace for your Brika hub
            </h1>
            <p className="max-w-md text-lg text-muted-foreground leading-relaxed">
              Discover, compare, and review plugins. Powered by npm, enriched with a community of
              builders.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={focusSearch}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-brand-foreground shadow-[0_8px_20px_-8px_rgba(242,84,45,0.6)] transition-opacity hover:opacity-90"
              >
                <Search className="size-4" />
                Search the store
              </button>
              <Link
                to="/plugins"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-5 py-3 font-semibold transition-colors hover:bg-muted"
              >
                Browse all
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          {hero ? <HeroCard plugin={hero} /> : null}
        </div>
      </section>

      {featured.length > 0 ? (
        <Rail title="Featured">
          {featured.map((plugin) => (
            <PluginCard key={plugin.name} plugin={plugin} />
          ))}
        </Rail>
      ) : null}

      {trending.length > 0 ? (
        <Rail
          title="Trending this week"
          icon={<TrendingUp className="size-5 text-brand-ink" />}
          seeAll
        >
          {trending.map((plugin) => (
            <PluginCard key={plugin.name} plugin={plugin} />
          ))}
        </Rail>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-bold font-heading text-2xl tracking-tight">Browse by capability</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CAPABILITY_TILES.map((tile) => (
            <Link
              key={tile.key}
              to="/plugins"
              search={{ q: tile.key }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand"
            >
              <span
                className="flex size-10 items-center justify-center rounded-xl text-white shadow-sm"
                style={{ background: gradientCss(tile.gradient) }}
              >
                <tile.glyph className="size-5" />
              </span>
              <div className="flex flex-col">
                <span className="font-heading font-semibold text-foreground text-sm">
                  {tile.label}
                </span>
                <span className="text-muted-foreground text-xs">Explore</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function HeroCard({ plugin }: Readonly<{ plugin: PluginSummary }>) {
  return (
    <Link
      to="/plugins/$"
      params={{ _splat: plugin.name }}
      className="group flex flex-col gap-4 rounded-[18px] border border-border bg-card p-6 shadow-[0_24px_50px_-24px_rgba(30,20,10,0.3)] transition-transform hover:-translate-y-1"
    >
      <div className="flex items-center gap-3.5">
        <PluginIcon
          name={plugin.name}
          iconUrl={plugin.iconUrl}
          capabilities={plugin.capabilities}
          size={52}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold font-heading text-foreground text-lg">
              {plugin.displayName ?? plugin.name}
            </span>
            {plugin.verified ? <ShieldCheck className="size-4 shrink-0 text-brand-ink" /> : null}
          </div>
          {plugin.author ? (
            <p className="truncate text-muted-foreground text-sm">by {plugin.author.id}</p>
          ) : null}
        </div>
      </div>
      <p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
        {plugin.description ?? "No description provided."}
      </p>
      <div className="flex items-center justify-between pt-1">
        <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-muted-foreground text-xs">
          v{plugin.version}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-brand-ink text-sm">
          View plugin
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function Rail({
  title,
  icon,
  seeAll,
  children,
}: Readonly<{
  title: string;
  icon?: ReactNode;
  seeAll?: boolean;
  children: ReactNode;
}>) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 font-bold font-heading text-2xl tracking-tight">
          {icon}
          {title}
        </h2>
        {seeAll ? (
          <Link
            to="/plugins"
            className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          >
            See all
            <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function DirectionConsole({ plugins, total }: DirectionProps) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <DiscoverIndex plugins={plugins} total={total} />
    </main>
  );
}
