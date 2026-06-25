import {
  Button,
  Card,
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "@brika/clay";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@brika/clay/components/input-group";
import type { PluginSummary } from "@brika/registry-contract";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Box, ChevronRight, Rocket, Search, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Pager } from "@/components/clay/pagination";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { SegmentedControl } from "@/components/clay/segmented";
import { AdminShell } from "@/components/layout/admin-shell";
import { StatusBadge } from "@/components/plugin/status-badge";
import { useOwnedPlugins } from "@/hooks/use-owned-plugins";
import { type AppKey, useT } from "@/i18n";
import { paginate } from "@/lib/pagination";

const route = getRouteApi("/dashboard/plugins/");
const PAGE_SIZE = 8;

/** The status segments. `taken_down` is folded under "Yanked" so the filter stays simple. */
type StatusFilter = "all" | "published" | "deprecated" | "yanked";
const STATUS_FILTERS: ReadonlyArray<{ value: StatusFilter; labelKey: AppKey }> = [
  { value: "all", labelKey: "plugin:filterAll" },
  { value: "published", labelKey: "plugin:filterPublished" },
  { value: "deprecated", labelKey: "plugin:filterDeprecated" },
  { value: "yanked", labelKey: "plugin:filterYanked" },
];

export function MyPluginsPage() {
  const t = useT();
  const { user } = route.useRouteContext();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [scope, setScope] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Debounce the search box so a keystroke does not hit the server every time; applying the query
  // also returns to page 1. Status/scope reset the page inline at the click.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  // Server-side filter + pagination: only this page's rows come over the wire.
  const { data } = useOwnedPlugins({
    q: debounced,
    status,
    scope,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const items = data?.page.items ?? [];
  const pagination = paginate(data?.page.total ?? 0, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const statusOptions = STATUS_FILTERS.map((filter) => ({
    value: filter.value,
    label: t(filter.labelKey),
  }));

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="My plugins">
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
              {t("plugin:myPlugins")}
            </h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">{t("plugin:myPluginsIntro")}</p>
          </div>
          <Button asChild>
            <Link to="/dashboard/plugins/create">
              <Rocket className="size-4" />
              {t("plugin:createCta")}
            </Link>
          </Button>
        </div>

        {/* toolbar: search + status segmented filter */}
        <div className="flex flex-wrap items-center gap-3">
          <InputGroup className="min-w-[230px] flex-1">
            <InputGroupAddon align="inline-start">
              <Search className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("plugin:searchPlaceholder")}
            />
          </InputGroup>
          <SegmentedControl
            options={statusOptions}
            value={status}
            onChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
            fill={false}
            ariaLabel={t("plugin:filterByStatus")}
          />
        </div>

        {/* scope chips (facet counts over the full owned set, from the server) */}
        <div className="flex flex-wrap items-center gap-2">
          <ScopeChip
            label={t("plugin:filterAll")}
            count={data?.stats.total ?? 0}
            active={scope === null}
            onClick={() => {
              setScope(null);
              setPage(1);
            }}
          />
          {(data?.scopes ?? []).map((facet) => (
            <ScopeChip
              key={facet.scope}
              label={facet.scope}
              count={facet.count}
              mono
              active={scope === facet.scope}
              onClick={() => {
                setScope(facet.scope);
                setPage(1);
              }}
            />
          ))}
        </div>

        {/* table */}
        <Card className="overflow-hidden rounded-[20px] p-0 shadow-sm">
          <div className="grid grid-cols-[1fr_130px_130px_52px] items-center gap-3.5 border-border border-b bg-muted px-5 py-3 font-bold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
            <div>{t("plugin:columnPlugin")}</div>
            <div>{t("plugin:columnStatus")}</div>
            <div>{t("plugin:columnCapabilities")}</div>
            <div />
          </div>
          {items.length === 0 ? (
            <EmptyState className="py-[54px]">
              <EmptyStateIcon>
                <Box />
              </EmptyStateIcon>
              <EmptyStateTitle>{t("plugin:noPluginsMatchTitle")}</EmptyStateTitle>
              <EmptyStateDescription>{t("plugin:noPluginsMatchDescription")}</EmptyStateDescription>
            </EmptyState>
          ) : (
            items.map((plugin) => <PluginRow key={plugin.name} plugin={plugin} />)
          )}
        </Card>

        <Pager pagination={pagination} onPageChange={setPage} />
      </section>
    </AdminShell>
  );
}

/** A rounded-full scope pill with a trailing count badge. */
function ScopeChip({
  label,
  count,
  active,
  onClick,
  mono = false,
}: Readonly<{
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  mono?: boolean;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-full border py-0 pr-2 pl-3 font-semibold text-xs transition-colors ${
        active
          ? "border-brand-border bg-brand-tint text-brand-ink"
          : "border-input bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className={mono ? "font-mono" : undefined}>{label}</span>
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 font-bold text-[11px]">
        {count}
      </span>
    </button>
  );
}

function PluginRow({ plugin }: Readonly<{ plugin: PluginSummary }>) {
  const t = useT();
  const caps = plugin.capabilities
    ? plugin.capabilities.tools +
      plugin.capabilities.blocks +
      plugin.capabilities.bricks +
      plugin.capabilities.sparks +
      plugin.capabilities.pages
    : 0;
  return (
    <Link
      to="/dashboard/plugins/$"
      params={{ _splat: plugin.name }}
      aria-label={t("plugin:editPlugin", { name: plugin.name })}
      className="grid grid-cols-[1fr_130px_130px_52px] items-center gap-3.5 border-border border-b px-5 py-[15px] text-left transition-colors last:border-b-0 hover:bg-muted"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <PluginIcon
          name={plugin.name}
          iconUrl={plugin.iconUrl}
          capabilities={plugin.capabilities}
          size={42}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-heading font-semibold text-[14.5px] text-foreground">
              {plugin.displayName ?? plugin.name}
            </span>
            {plugin.verified ? <ShieldCheck className="size-3.5 shrink-0 text-brand-ink" /> : null}
          </div>
          <div className="truncate font-mono text-[12px] text-muted-foreground">
            {plugin.name}
            {plugin.version ? ` · v${plugin.version}` : ""}
          </div>
        </div>
      </div>
      <div>
        <StatusBadge status={plugin.listingStatus} />
      </div>
      <div className="text-[13px] text-muted-foreground">
        {caps > 0 ? t("plugin:capabilitiesCount", { count: caps }) : "·"}
      </div>
      <div className="flex justify-end">
        <span className="flex size-8 items-center justify-center rounded-[9px] border border-input text-muted-foreground">
          <ChevronRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}
