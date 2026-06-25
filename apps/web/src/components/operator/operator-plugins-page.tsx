import { Checkbox } from "@brika/clay/components/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@brika/clay/components/input-group";
import type { Translate } from "@brika/i18n";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Flag, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { OperatorPager, useClientPage } from "@/components/operator/operator-pager";
import { OperatorShell } from "@/components/operator/operator-shell";
import {
  BulkBar,
  type Facet,
  FacetChips,
  OperatorHeader,
  SortSelect,
} from "@/components/operator/operator-toolbar";
import { VersionPanel } from "@/components/operator/plugin-version-panel";
import { TakedownControls } from "@/components/operator/takedown-controls";
import { useOperatorList } from "@/hooks/use-operator-list";
import {
  type OperatorPlugin,
  useBulkTakedown,
  usePluginModeration,
} from "@/hooks/use-operator-plugins";
import { type AppKey, useRelativeTime, useT } from "@/i18n";
import { formatCount } from "@/lib/format";
import { reportReasonLabelKey } from "@/lib/reports";

type AppTranslate = Translate<AppKey>;

type PkgFacet = "all" | "review" | "takedowns" | "hidden";
type PkgSort = "flagged" | "installs" | "recent" | "name";

const FACET_PREDICATES: Record<PkgFacet, (p: OperatorPlugin) => boolean> = {
  all: () => true,
  review: (p) => p.openReports > 0,
  takedowns: (p) => p.takenDownCount > 0 || p.takedown !== null,
  // A plugin whose versions all exist but none resolves as `latest` is fully hidden.
  hidden: (p) => p.versionCount > 0 && p.latestVersion === null,
};

export function OperatorPluginsPage() {
  const t = useT();
  const list = useOperatorList<OperatorPlugin>("/api/operator/plugins");
  const [facet, setFacet] = useState<PkgFacet>("all");
  const [sort, setSort] = useState<PkgSort>("flagged");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const facets: Facet<PkgFacet>[] = useMemo(
    () => [
      { key: "all", label: t("operator:pluginsFacetAll"), count: list.items.length },
      {
        key: "review",
        label: t("operator:pluginsFacetReview"),
        count: list.items.filter(FACET_PREDICATES.review).length,
      },
      {
        key: "takedowns",
        label: t("operator:pluginsFacetTakedowns"),
        count: list.items.filter(FACET_PREDICATES.takedowns).length,
      },
      {
        key: "hidden",
        label: t("operator:pluginsFacetHidden"),
        count: list.items.filter(FACET_PREDICATES.hidden).length,
      },
    ],
    [list.items, t],
  );

  const visible = useMemo(() => {
    const rows = list.items.filter(FACET_PREDICATES[facet]);
    rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "installs") return b.installs - a.installs;
      if (sort === "recent") return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
      return b.openReports - a.openReports || b.takenDownCount - a.takenDownCount; // "flagged"
    });
    return rows;
  }, [list.items, facet, sort]);

  const { page, setPage, pageCount, pageItems } = useClientPage(visible);

  // Scope the selection to what's actually on screen: a facet/search change drops out-of-view picks
  // from the count and the bulk payload, so the operator only ever acts on plugins they can see.
  const selectedNames = useMemo(
    () => visible.filter((p) => selected.has(p.name)).map((p) => p.name),
    [visible, selected],
  );
  const allSelected = visible.length > 0 && selectedNames.length === visible.length;
  // Indeterminate when some (but not all) visible plugins are selected.
  const someSelected = selectedNames.length > 0 && !allSelected;

  // On a successful bulk takedown, drop the (now actioned) selection then refetch the window.
  const { busy, error, setError, bulkTakedown } = useBulkTakedown(selectedNames, () => {
    setSelected(new Set());
    list.reload();
  });

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map((p) => p.name)));
  }

  function shownLabel(): string {
    if (list.loading) return t("operator:loading");
    if (list.capped)
      return t("operator:pluginsShowingCapped", { shown: visible.length, total: list.total });
    return t("operator:pluginsShowing", { shown: visible.length });
  }

  function renderList() {
    if (list.loading)
      return <p className="px-1 text-muted-foreground text-sm">{t("operator:loading")}</p>;
    if (visible.length === 0) {
      return <p className="px-1 text-muted-foreground text-sm">{t("operator:pluginsEmpty")}</p>;
    }
    return (
      <>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {pageItems.map((pkg) => (
            <PluginRow
              key={pkg.name}
              pkg={pkg}
              selected={selected.has(pkg.name)}
              onToggle={() => toggle(pkg.name)}
              onError={setError}
              onChanged={list.reload}
            />
          ))}
        </ul>
        <OperatorPager page={page} pageCount={pageCount} onPage={setPage} />
      </>
    );
  }

  return (
    <OperatorShell activeLabel="plugins">
      <OperatorHeader title={t("operator:pluginsTitle")}>
        {t("operator:pluginsIntro")}
      </OperatorHeader>

      <div className="flex flex-wrap items-center gap-3">
        <FacetChips facets={facets} active={facet} onSelect={setFacet} />
        <div className="min-w-3 flex-1" />
        <InputGroup className="min-w-[220px] max-w-xs flex-1">
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            value={list.query}
            onChange={(e) => list.setQuery(e.target.value)}
            placeholder={t("operator:pluginsSearchPlaceholder")}
          />
        </InputGroup>
        <SortSelect
          value={sort}
          onChange={setSort}
          options={[
            { value: "flagged", label: t("operator:pluginsSortFlagged") },
            { value: "installs", label: t("operator:pluginsSortInstalls") },
            { value: "recent", label: t("operator:pluginsSortRecent") },
            { value: "name", label: t("operator:pluginsSortName") },
          ]}
        />
      </div>

      <div className="flex items-center gap-2.5 px-1">
        <Checkbox
          checked={someSelected ? "indeterminate" : allSelected}
          onCheckedChange={toggleAll}
          aria-label={t("operator:selectAllPlugins")}
        />
        <span className="text-muted-foreground text-xs">{shownLabel()}</span>
      </div>

      {error !== null && <p className="text-destructive text-sm">{error}</p>}
      {selectedNames.length > 0 && (
        <BulkBar
          count={selectedNames.length}
          noun={t("operator:pluginNoun")}
          busy={busy}
          onTakedown={bulkTakedown}
          onClear={() => setSelected(new Set())}
        />
      )}

      {renderList()}
    </OperatorShell>
  );
}

function metaLine(
  pkg: OperatorPlugin,
  relative: (value: string | Date | undefined) => string,
  t: AppTranslate,
): string {
  const parts = [t("operator:metaVersions", { count: pkg.versionCount })];
  if (pkg.installs > 0)
    parts.push(t("operator:metaInstalls", { installs: formatCount(pkg.installs) }));
  const updated = relative(pkg.updatedAt ?? undefined);
  if (updated) parts.push(t("operator:metaUpdated", { relative: updated }));
  if (pkg.flagReason !== null)
    parts.push(t("operator:metaFlagged", { reason: t(reportReasonLabelKey(pkg.flagReason)) }));
  return parts.join(" · ");
}

function PluginRow({
  pkg,
  selected,
  onToggle,
  onError,
  onChanged,
}: Readonly<{
  pkg: OperatorPlugin;
  selected: boolean;
  onToggle: () => void;
  onError: (message: string | null) => void;
  onChanged: () => void;
}>) {
  const t = useT();
  const relative = useRelativeTime();
  const [open, setOpen] = useState(false);
  const { versions, busy, pkgBusy, loadVersions, act, takedownPlugin, restorePlugin, setVerified } =
    usePluginModeration(pkg, open, onChanged, onError);

  function expand() {
    const next = !open;
    setOpen(next);
    if (next && versions === null) void loadVersions();
  }

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={t("operator:selectPlugin", { name: pkg.name })}
          className="shrink-0"
        />
        <button
          type="button"
          onClick={expand}
          aria-label={
            open
              ? t("operator:collapsePlugin", { name: pkg.name })
              : t("operator:expandPlugin", { name: pkg.name })
          }
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-transform hover:bg-muted hover:text-foreground"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <PluginIcon name={pkg.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono font-semibold text-sm">{pkg.name}</span>
            {pkg.latestVersion === null && pkg.versionCount > 0 && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground text-xs">
                {t("operator:hiddenBadge")}
              </span>
            )}
            {pkg.openReports > 0 && (
              <Link
                to="/operator/reports"
                search={{ q: pkg.name, status: "open", page: 1 }}
                title={t("operator:viewPluginReports")}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 text-xs transition-colors hover:bg-amber-500/20 dark:text-amber-400"
              >
                <Flag className="size-3" />
                {t("operator:pluginReports", { count: pkg.openReports })}
              </Link>
            )}
            {pkg.takedown !== null && (
              <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive text-xs">
                {t("operator:pluginTakenDownBadge")}
              </span>
            )}
            {pkg.takedown === null && pkg.takenDownCount > 0 && (
              <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive text-xs">
                {t("operator:versionsDownBadge", { count: pkg.takenDownCount })}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-muted-foreground text-xs">
            {metaLine(pkg, relative, t)}
          </div>
        </div>
        <button
          type="button"
          disabled={pkgBusy}
          onClick={() => setVerified(!pkg.verified)}
          title={pkg.verified ? t("operator:verified") : t("operator:verify")}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-xs transition-colors disabled:opacity-50 ${
            pkg.verified
              ? "bg-brand/10 text-brand-ink hover:bg-brand/20"
              : "border border-border text-muted-foreground hover:border-brand/40 hover:text-foreground"
          }`}
        >
          <ShieldCheck className="size-3.5" />
          {pkg.verified ? t("operator:verified") : t("operator:verify")}
        </button>
        <TakedownControls
          subject={pkg.name}
          takenDown={pkg.takedown !== null}
          busy={pkgBusy}
          onTakedown={takedownPlugin}
          onRestore={restorePlugin}
        />
      </div>

      {open && <VersionPanel pkg={pkg} versions={versions} busy={busy} onAct={act} />}
    </li>
  );
}
