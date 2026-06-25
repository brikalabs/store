import type { PluginSummary } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Box,
  Code,
  FileText,
  Filter,
  Layers,
  type LucideIcon,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { type ReactNode, type SyntheticEvent, useState } from "react";
import type { Gradient } from "@/components/clay/gradients";
import { GradientAvatar, PluginIcon } from "@/components/clay/plugin-icon";
import { ListingCard } from "@/components/plugin/listing-card";
import { type SortKey, SortMenu, sortPlugins } from "@/components/plugin/sort-menu";
import { useT } from "@/i18n";

export type CapabilityTile = { key: string; label: string; glyph: LucideIcon; gradient: Gradient };

export const CAPABILITY_TILES: CapabilityTile[] = [
  { key: "tools", label: "Tools", glyph: Code, gradient: ["#FF8A5B", "#F2542D"] },
  { key: "blocks", label: "Blocks", glyph: Layers, gradient: ["#5B8DEF", "#3A5BD9"] },
  { key: "bricks", label: "Bricks", glyph: Box, gradient: ["#19C39C", "#0E8C6F"] },
  { key: "sparks", label: "Sparks", glyph: Zap, gradient: ["#A66BFF", "#6D34C9"] },
  { key: "pages", label: "Pages", glyph: FileText, gradient: ["#7C8696", "#525C6B"] },
];

type Scope = { scope: string; name: string; count: number };

function topScopes(plugins: PluginSummary[], limit: number): Scope[] {
  const byScope = new Map<string, Scope>();
  for (const plugin of plugins) {
    const scope = scopeOf(plugin.name);
    if (scope === null) continue;
    const existing = byScope.get(scope);
    if (existing) {
      existing.count += 1;
    } else {
      byScope.set(scope, {
        scope,
        name: plugin.author?.name ?? scope,
        count: 1,
      });
    }
  }
  return [...byScope.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** The dense discovery index: filter rail, plugin grid, and a Trending + Top authors rail. */
export function DiscoverIndex({
  plugins,
  total,
  title,
}: Readonly<{ plugins: PluginSummary[]; total: number; title?: string }>) {
  const t = useT();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<SortKey>("downloads");
  const heading = title ?? t("plugin:discoverTitle");
  const scopes = topScopes(plugins, 5);
  const trending = plugins.slice(0, 5);
  const sorted = sortPlugins(plugins, sort);

  function submitFilter(event: SyntheticEvent) {
    event.preventDefault();
    const next = term.trim();
    navigate({ to: "/plugins", search: next.length > 0 ? { q: next } : {} });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-bold font-heading text-3xl tracking-tight">{heading}</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("plugin:verifiedScopedPlugins", { count: total })}
          </p>
        </div>
        <SortMenu value={sort} onChange={setSort} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[206px_1fr_236px]">
        <aside className="hidden flex-col gap-6 lg:flex">
          <form onSubmit={submitFilter} className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t("plugin:filterPlugins")}
              className="h-10 w-full rounded-xl border border-border bg-card pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/50"
            />
          </form>
          <FilterGroup label={t("plugin:capability")} icon={<Filter className="size-3.5" />}>
            {CAPABILITY_TILES.map((tile) => (
              <Link
                key={tile.key}
                to="/plugins"
                search={{ q: tile.key }}
                className="flex items-center justify-between rounded-md px-1 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
              >
                {tile.label}
              </Link>
            ))}
          </FilterGroup>
          <div className="h-px bg-border" />
          <FilterGroup label={t("plugin:trust")}>
            <span className="flex items-center gap-2 text-foreground text-sm">
              <ShieldCheck className="size-3.5 text-brand-ink" />
              {t("plugin:verifiedOnly")}
            </span>
          </FilterGroup>
        </aside>

        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((plugin) => (
            <ListingCard key={plugin.name} plugin={plugin} />
          ))}
        </div>

        <aside className="hidden flex-col gap-5 lg:flex">
          <RailCard
            title={t("plugin:trending")}
            icon={<TrendingUp className="size-4 text-brand-ink" />}
          >
            {trending.map((plugin, index) => (
              <Link
                key={plugin.name}
                to="/$"
                params={{ _splat: plugin.name }}
                className="flex items-center gap-3"
              >
                <span className="w-3.5 font-bold font-heading text-muted-foreground/60 text-sm">
                  {index + 1}
                </span>
                <PluginIcon
                  name={plugin.name}
                  iconUrl={plugin.iconUrl}
                  capabilities={plugin.capabilities}
                  size={30}
                />
                <span className="min-w-0 flex-1 truncate font-heading font-semibold text-foreground text-xs">
                  {plugin.displayName ?? plugin.name}
                </span>
              </Link>
            ))}
          </RailCard>

          {scopes.length > 0 ? (
            <RailCard
              title={t("plugin:topScopes")}
              icon={<Users className="size-4 text-brand-ink" />}
            >
              {scopes.map((scope) => (
                <Link
                  key={scope.scope}
                  to="/$"
                  params={{ _splat: scope.scope }}
                  className="flex items-center gap-2.5"
                >
                  <GradientAvatar
                    seed={scope.scope}
                    label={scope.name}
                    imageUrl={`/api/scopes/${encodeURIComponent(scope.scope)}/icon`}
                    size={30}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground text-xs">
                      {scope.name}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {t("plugin:pluginCount", { count: scope.count })}
                    </div>
                  </div>
                </Link>
              ))}
            </RailCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  icon,
  children,
}: Readonly<{ label: string; icon?: ReactNode; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 font-heading font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function RailCard({
  title,
  icon,
  children,
}: Readonly<{ title: string; icon: ReactNode; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-[17px]">
      <div className="flex items-center gap-2 font-heading font-semibold text-foreground text-sm">
        {icon}
        {title}
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </div>
  );
}
