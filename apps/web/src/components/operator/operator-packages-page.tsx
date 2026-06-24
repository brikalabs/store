import { Input } from "@brika/clay";
import { Checkbox } from "@brika/clay/components/checkbox";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Flag, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { OperatorShell } from "@/components/operator/operator-shell";
import {
  BulkBar,
  type Facet,
  FacetChips,
  OperatorHeader,
  SortSelect,
} from "@/components/operator/operator-toolbar";
import { VersionPanel } from "@/components/operator/package-version-panel";
import { TakedownControls } from "@/components/operator/takedown-controls";
import { useOperatorList } from "@/hooks/use-operator-list";
import {
  type OperatorPackage,
  useBulkTakedown,
  usePackageModeration,
} from "@/hooks/use-operator-packages";
import { formatCount, formatRelative } from "@/lib/format";
import { reportReasonLabel } from "@/lib/reports";

type PkgFacet = "all" | "review" | "takedowns" | "hidden";
type PkgSort = "flagged" | "installs" | "recent" | "name";

const FACET_PREDICATES: Record<PkgFacet, (p: OperatorPackage) => boolean> = {
  all: () => true,
  review: (p) => p.openReports > 0,
  takedowns: (p) => p.takenDownCount > 0,
  // A package whose versions all exist but none resolves as `latest` is fully hidden.
  hidden: (p) => p.versionCount > 0 && p.latestVersion === null,
};

export function OperatorPackagesPage() {
  const list = useOperatorList<OperatorPackage>("/api/operator/packages");
  const [facet, setFacet] = useState<PkgFacet>("all");
  const [sort, setSort] = useState<PkgSort>("flagged");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const facets: Facet<PkgFacet>[] = useMemo(
    () => [
      { key: "all", label: "All packages", count: list.items.length },
      {
        key: "review",
        label: "Needs review",
        count: list.items.filter(FACET_PREDICATES.review).length,
      },
      {
        key: "takedowns",
        label: "Has takedowns",
        count: list.items.filter(FACET_PREDICATES.takedowns).length,
      },
      { key: "hidden", label: "Hidden", count: list.items.filter(FACET_PREDICATES.hidden).length },
    ],
    [list.items],
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

  // Scope the selection to what's actually on screen: a facet/search change drops out-of-view picks
  // from the count and the bulk payload, so the operator only ever acts on packages they can see.
  const selectedNames = useMemo(
    () => visible.filter((p) => selected.has(p.name)).map((p) => p.name),
    [visible, selected],
  );
  const allSelected = visible.length > 0 && selectedNames.length === visible.length;
  // Indeterminate when some (but not all) visible packages are selected.
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
    if (list.loading) return "Loading…";
    if (list.capped) return `Showing ${visible.length} of ${list.total}`;
    return `Showing ${visible.length}`;
  }

  function renderList() {
    if (list.loading) return <p className="px-1 text-muted-foreground text-sm">Loading…</p>;
    if (visible.length === 0) {
      return <p className="px-1 text-muted-foreground text-sm">No packages match.</p>;
    }
    return (
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {visible.map((pkg) => (
          <PackageRow
            key={pkg.name}
            pkg={pkg}
            selected={selected.has(pkg.name)}
            onToggle={() => toggle(pkg.name)}
            onError={setError}
            onChanged={list.reload}
          />
        ))}
      </ul>
    );
  }

  return (
    <OperatorShell activeLabel="Packages">
      <OperatorHeader title="Packages">
        Work the moderation queue, or search the whole registry. Expand a package to moderate
        individual versions. Every action records its reason in the audit log.
      </OperatorHeader>

      <div className="flex flex-wrap items-center gap-3">
        <FacetChips facets={facets} active={facet} onSelect={setFacet} />
        <div className="min-w-3 flex-1" />
        <div className="relative min-w-[220px] max-w-xs flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            value={list.query}
            onChange={(e) => list.setQuery(e.target.value)}
            placeholder="Search package or owner"
            className="pl-9"
          />
        </div>
        <SortSelect
          value={sort}
          onChange={setSort}
          options={[
            { value: "flagged", label: "Most flagged" },
            { value: "installs", label: "Most installed" },
            { value: "recent", label: "Recently updated" },
            { value: "name", label: "Name A–Z" },
          ]}
        />
      </div>

      <div className="flex items-center gap-2.5 px-1">
        <Checkbox
          checked={someSelected ? "indeterminate" : allSelected}
          onCheckedChange={toggleAll}
          aria-label="Select all packages on this page"
        />
        <span className="text-muted-foreground text-xs">{shownLabel()}</span>
      </div>

      {error !== null && <p className="text-destructive text-sm">{error}</p>}
      {selectedNames.length > 0 && (
        <BulkBar
          count={selectedNames.length}
          noun="package"
          busy={busy}
          onTakedown={bulkTakedown}
          onClear={() => setSelected(new Set())}
        />
      )}

      {renderList()}
    </OperatorShell>
  );
}

function metaLine(pkg: OperatorPackage): string {
  const parts = [`${pkg.versionCount} version${pkg.versionCount === 1 ? "" : "s"}`];
  if (pkg.installs > 0) parts.push(`${formatCount(pkg.installs)} installs`);
  const updated = formatRelative(pkg.updatedAt ?? undefined);
  if (updated) parts.push(`updated ${updated}`);
  if (pkg.flagReason !== null) parts.push(`Flagged: ${reportReasonLabel(pkg.flagReason)}`);
  return parts.join(" · ");
}

function PackageRow({
  pkg,
  selected,
  onToggle,
  onError,
  onChanged,
}: Readonly<{
  pkg: OperatorPackage;
  selected: boolean;
  onToggle: () => void;
  onError: (message: string | null) => void;
  onChanged: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const { versions, busy, pkgBusy, loadVersions, act, takedownPackage } = usePackageModeration(
    pkg,
    open,
    onChanged,
    onError,
  );

  function expand() {
    const next = !open;
    setOpen(next);
    if (next && versions === null) void loadVersions();
  }

  const liveVersions = pkg.versionCount - pkg.takenDownCount;

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${pkg.name}`}
          className="shrink-0"
        />
        <button
          type="button"
          onClick={expand}
          aria-label={open ? `Collapse ${pkg.name}` : `Expand ${pkg.name}`}
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
                Hidden
              </span>
            )}
            {pkg.openReports > 0 && (
              <Link
                to="/operator/reports"
                search={{ q: pkg.name, status: "open", page: 1 }}
                title="View reports for this package"
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 text-xs transition-colors hover:bg-amber-500/20 dark:text-amber-400"
              >
                <Flag className="size-3" />
                {pkg.openReports} report{pkg.openReports === 1 ? "" : "s"}
              </Link>
            )}
            {pkg.takenDownCount > 0 && (
              <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive text-xs">
                {pkg.takenDownCount} version{pkg.takenDownCount === 1 ? "" : "s"} down
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-muted-foreground text-xs">{metaLine(pkg)}</div>
        </div>
        {liveVersions > 0 ? (
          <TakedownControls
            takenDown={false}
            busy={pkgBusy}
            onTakedown={takedownPackage}
            onRestore={() => {}}
          />
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
            All versions down
          </span>
        )}
      </div>

      {open && <VersionPanel pkg={pkg} versions={versions} busy={busy} onAct={act} />}
    </li>
  );
}
