import { Switch } from "@brika/clay";
import type { PluginSummary, SearchDirection } from "@brika/registry-contract";
import { Link } from "@tanstack/react-router";
import { Filter, ShieldCheck, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";
import { PageNav } from "@/components/clay/pagination";
import { GradientAvatar, PluginIcon } from "@/components/clay/plugin-icon";
import { CAPABILITY_TILES } from "@/components/plugin/capability-tiles";
import { ListingCard } from "@/components/plugin/listing-card";
import { type SortKey, SortMenu } from "@/components/plugin/sort-menu";
import { VerifiedBadge } from "@/components/plugin/verified-badge";
import { useT } from "@/i18n";
import { paginate } from "@/lib/pagination";
import { topScopes } from "@/lib/registry/matching-scopes";

/** Server-paginated grid (the host owns offset/total and re-queries on change). */
export interface PageControl {
  readonly offset: number;
  readonly total: number;
  readonly pageSize: number;
  readonly onChange: (offset: number) => void;
}

/**
 * The dense discovery index: a filter rail, the plugin grid, and a Trending + Popular-spaces rail.
 * Fully controlled - sort/verified state and the data come from the host, which decides whether to
 * re-query the server (`/plugins`, URL-driven + paginated) or sort/filter in memory (home A/B).
 */
export function DiscoverIndex({
  plugins,
  railsPlugins,
  count,
  field,
  direction,
  verifiedOnly,
  onSortChange,
  onVerifiedChange,
  page,
  title,
}: Readonly<{
  plugins: PluginSummary[];
  railsPlugins: PluginSummary[];
  count: number;
  field: SortKey;
  direction: SearchDirection;
  verifiedOnly: boolean;
  onSortChange: (field: SortKey, direction: SearchDirection) => void;
  onVerifiedChange: (verified: boolean) => void;
  page?: PageControl;
  title?: string;
}>) {
  const t = useT();
  const heading = title ?? t("plugin:discoverTitle");
  const trending = railsPlugins.slice(0, 5);
  const scopes = topScopes(railsPlugins, 5);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-bold font-heading text-3xl tracking-tight">{heading}</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("plugin:verifiedScopedPlugins", { count })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.08em]">
            {t("plugin:sort")}
          </span>
          <SortMenu field={field} direction={direction} onChange={onSortChange} />
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
                onCheckedChange={onVerifiedChange}
                size="sm"
                aria-label={t("plugin:verifiedOnly")}
              />
            </div>
          </FilterGroup>
        </aside>

        <div className="flex flex-col gap-5">
          <div className="grid auto-rows-min gap-3.5 sm:grid-cols-2">
            {plugins.map((plugin) => (
              <ListingCard key={plugin.name} plugin={plugin} />
            ))}
          </div>
          {page ? (
            <PageNav
              pagination={paginate(page.total, { limit: page.pageSize, offset: page.offset })}
              onPageChange={(p) => page.onChange((p - 1) * page.pageSize)}
            />
          ) : null}
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
                    <div className="flex items-center gap-0.5 font-semibold text-foreground text-xs">
                      <span className="truncate">{scope.name}</span>
                      {scope.verified ? <VerifiedBadge className="size-3.5" /> : null}
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
