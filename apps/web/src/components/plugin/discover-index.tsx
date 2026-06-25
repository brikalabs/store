import { Switch } from "@brika/clay";
import type { PluginSummary, SearchDirection } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { Link } from "@tanstack/react-router";
import { Filter, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { GradientAvatar, PluginIcon } from "@/components/clay/plugin-icon";
import { CAPABILITY_TILES } from "@/components/plugin/capability-tiles";
import { ListingCard } from "@/components/plugin/listing-card";
import { type SortKey, SortMenu, sortPlugins } from "@/components/plugin/sort-menu";
import { useT } from "@/i18n";

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
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [field, setField] = useState<SortKey>("downloads");
  const [direction, setDirection] = useState<SearchDirection>("desc");
  const heading = title ?? t("plugin:discoverTitle");
  const scopes = topScopes(plugins, 5);
  const trending = plugins.slice(0, 5);
  const ranked = sortPlugins(plugins, field, direction);
  // The store lists only verified, scoped plugins; the toggle narrows to them. Full-catalog search
  // lives in the global header, so the rail has no input of its own.
  const shown = verifiedOnly ? ranked.filter((plugin) => plugin.verified) : ranked;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-bold font-heading text-3xl tracking-tight">{heading}</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("plugin:verifiedScopedPlugins", { count: total })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.08em]">
            {t("plugin:sort")}
          </span>
          <SortMenu
            field={field}
            direction={direction}
            onChange={(nextField, nextDirection) => {
              setField(nextField);
              setDirection(nextDirection);
            }}
          />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[206px_1fr_236px]">
        <aside className="hidden flex-col gap-6 lg:flex">
          <FilterGroup label={t("plugin:capability")} icon={<Filter className="size-3.5" />}>
            {CAPABILITY_TILES.map((tile) => (
              <Link
                key={tile.key}
                to="/plugins"
                search={{ capabilities: [tile.key] }}
                className="flex items-center gap-2.5 rounded-md px-1 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
              >
                <tile.glyph className="size-3.5" />
                {tile.label}
              </Link>
            ))}
          </FilterGroup>
          <div className="h-px bg-border" />
          <FilterGroup label={t("plugin:trust")}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-foreground text-sm">
                <ShieldCheck className="size-3.5 text-brand-ink" />
                {t("plugin:verifiedOnly")}
              </span>
              <Switch
                checked={verifiedOnly}
                onCheckedChange={setVerifiedOnly}
                size="sm"
                aria-label={t("plugin:verifiedOnly")}
              />
            </div>
          </FilterGroup>
        </aside>

        <div className="grid auto-rows-min gap-3.5 sm:grid-cols-2">
          {shown.map((plugin) => (
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
