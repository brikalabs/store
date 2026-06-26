import type { PluginSummary } from "@brika/registry-contract";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Search, Sparkles, TrendingUp } from "lucide-react";
import { gradientCss } from "@/components/clay/gradients";
import { useSearch } from "@/components/layout/search-context";
import { CAPABILITY_TILES } from "@/components/plugin/capability-tiles";
import { ListingCard } from "@/components/plugin/listing-card";
import { useT } from "@/i18n";
import { HeroCard } from "./hero-card";
import { Rail } from "./rail";

export type DirectionProps = Readonly<{ plugins: PluginSummary[]; total: number }>;

export function DirectionSpotlight({ plugins, total }: DirectionProps) {
  const { focusSearch } = useSearch();
  const t = useT();
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
              {t("home:badgeCount", { count: total })}
            </span>
            <h1 className="text-balance font-bold font-heading text-5xl leading-[1.02] tracking-tight sm:text-6xl">
              {t("home:heroTitle")}
            </h1>
            <p className="max-w-md text-lg text-muted-foreground leading-relaxed">
              {t("home:heroSubtitle")}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={focusSearch}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-brand-foreground shadow-[0_8px_20px_-8px_rgba(242,84,45,0.6)] transition-opacity hover:opacity-90"
              >
                <Search className="size-4" />
                {t("home:searchCta")}
              </button>
              <Link
                to="/plugins"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-5 py-3 font-semibold transition-colors hover:bg-muted"
              >
                {t("home:browseAll")}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
          {hero ? <HeroCard plugin={hero} /> : null}
        </div>
      </section>

      {featured.length > 0 ? (
        <Rail title={t("home:railFeatured")}>
          {featured.map((plugin) => (
            <ListingCard key={plugin.name} plugin={plugin} />
          ))}
        </Rail>
      ) : null}

      {trending.length > 0 ? (
        <Rail
          title={t("home:railTrending")}
          icon={<TrendingUp className="size-5 text-brand-ink" />}
          seeAll
        >
          {trending.map((plugin) => (
            <ListingCard key={plugin.name} plugin={plugin} />
          ))}
        </Rail>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-bold font-heading text-2xl tracking-tight">
          {t("home:capabilityHeading")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CAPABILITY_TILES.map((tile) => (
            <Link
              key={tile.key}
              to="/plugins"
              search={{ capabilities: [tile.key] }}
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
                <span className="text-muted-foreground text-xs">{t("home:explore")}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
