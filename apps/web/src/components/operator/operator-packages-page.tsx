import { Input } from "@brika/clay";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Flag, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { OperatorShell } from "@/components/operator/operator-shell";
import {
  BulkBar,
  type Facet,
  FacetChips,
  OperatorHeader,
  SortSelect,
} from "@/components/operator/operator-toolbar";
import { TakedownControls } from "@/components/operator/takedown-controls";
import { useOperatorList } from "@/hooks/use-operator-list";
import { formatBytes, formatCount, formatDate, formatRelative } from "@/lib/format";
import { reportReasonLabel } from "@/lib/reports";

interface OperatorPackage {
  name: string;
  scope: string | null;
  scopeDisplayName: string | null;
  latestVersion: string | null;
  versionCount: number;
  takenDownCount: number;
  yankedCount: number;
  updatedAt: string | null;
  installs: number;
  flagReason: string | null;
  openReports: number;
}

interface PackageVersion {
  version: string;
  publishedAt: string;
  size: number;
  deprecated: string | null;
  yanked: boolean;
  takedownReason: string | null;
}

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const bulkTakedown = useCallback(
    async (reason: string) => {
      setBusy(true);
      setError(null);
      const res = await fetch("/api/operator/packages/bulk-takedown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names: selectedNames, reason }),
      });
      setBusy(false);
      if (res.ok) {
        setSelected(new Set());
        list.reload();
        return;
      }
      const data: { error?: string } = await res.json();
      setError(data.error ?? "Bulk takedown failed");
    },
    [selectedNames, list.reload],
  );

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
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          aria-label="Select all packages on this page"
          className="size-4 cursor-pointer accent-brand"
        />
        <span className="text-muted-foreground text-xs">
          {list.loading
            ? "Loading…"
            : `Showing ${visible.length}${list.capped ? ` of ${list.total}` : ""}`}
        </span>
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
  const [versions, setVersions] = useState<PackageVersion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pkgBusy, setPkgBusy] = useState(false);

  const loadVersions = useCallback(async () => {
    const res = await fetch(`/api/operator/packages/versions?name=${encodeURIComponent(pkg.name)}`);
    if (res.ok) {
      const data: { versions: PackageVersion[] } = await res.json();
      setVersions(data.versions);
    }
  }, [pkg.name]);

  function expand() {
    const next = !open;
    setOpen(next);
    if (next && versions === null) void loadVersions();
  }

  const act = useCallback(
    async (version: string, path: "takedown" | "restore", reason?: string) => {
      setBusy(version);
      onError(null);
      const res = await fetch(`/api/operator/packages/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          path === "takedown" ? { name: pkg.name, version, reason } : { name: pkg.name, version },
        ),
      });
      setBusy(null);
      if (res.ok) {
        await loadVersions();
        onChanged();
        return;
      }
      const data: { error?: string } = await res.json();
      onError(data.error ?? "Action failed");
    },
    [pkg.name, loadVersions, onChanged, onError],
  );

  const takedownPackage = useCallback(
    async (reason: string) => {
      setPkgBusy(true);
      onError(null);
      const res = await fetch("/api/operator/packages/bulk-takedown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names: [pkg.name], reason }),
      });
      setPkgBusy(false);
      if (res.ok) {
        if (open) await loadVersions();
        onChanged();
        return;
      }
      const data: { error?: string } = await res.json();
      onError(data.error ?? "Take down failed");
    },
    [pkg.name, open, loadVersions, onChanged, onError],
  );

  const liveVersions = pkg.versionCount - pkg.takenDownCount;

  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${pkg.name}`}
          className="size-4 shrink-0 cursor-pointer accent-brand"
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

type VerFacet = "all" | "active" | "deprecated" | "yanked" | "takedown";

const VER_PREDICATES: Record<VerFacet, (v: PackageVersion) => boolean> = {
  all: () => true,
  active: (v) => v.takedownReason === null && !v.yanked && v.deprecated === null,
  deprecated: (v) => v.deprecated !== null,
  yanked: (v) => v.yanked,
  takedown: (v) => v.takedownReason !== null,
};

const VER_FACETS: { key: VerFacet; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "deprecated", label: "Deprecated" },
  { key: "yanked", label: "Yanked" },
  { key: "takedown", label: "Taken down" },
];

function VersionPanel({
  pkg,
  versions,
  busy,
  onAct,
}: Readonly<{
  pkg: OperatorPackage;
  versions: PackageVersion[] | null;
  busy: string | null;
  onAct: (version: string, path: "takedown" | "restore", reason?: string) => void;
}>) {
  const [facet, setFacet] = useState<VerFacet>("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    if (versions === null) return [];
    const needle = query.trim().toLowerCase();
    return versions
      .filter(VER_PREDICATES[facet])
      .filter((v) => needle === "" || v.version.toLowerCase().includes(needle));
  }, [versions, facet, query]);

  return (
    <div className="border-border border-t bg-muted/30 py-3.5 pr-4 pl-12">
      {versions === null ? (
        <p className="py-1 text-muted-foreground text-sm">Loading versions…</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <span className="font-semibold text-foreground text-sm">
              {pkg.versionCount} published version{pkg.versionCount === 1 ? "" : "s"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {VER_FACETS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFacet(f.key)}
                  className={`rounded-lg border px-2.5 py-1 font-medium text-xs transition-colors ${
                    f.key === facet
                      ? "border-brand/40 bg-brand/10 text-brand-ink"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="min-w-3 flex-1" />
            <div className="relative w-44">
              <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find version"
                className="h-8 pl-8 font-mono text-xs"
              />
            </div>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {shown.length === 0 ? (
              <li className="px-4 py-3 text-muted-foreground text-sm">No versions match.</li>
            ) : (
              shown.map((v) => (
                <li key={v.version} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-16 shrink-0 font-mono font-semibold text-sm">{v.version}</span>
                  {v.version === pkg.latestVersion && v.takedownReason === null && (
                    <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 font-semibold text-brand-ink text-xs">
                      latest
                    </span>
                  )}
                  {v.takedownReason !== null && (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive text-xs">
                      taken down
                    </span>
                  )}
                  {v.deprecated !== null && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                      deprecated
                    </span>
                  )}
                  {v.yanked && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                      yanked
                    </span>
                  )}
                  <div className="flex-1" />
                  <span className="shrink-0 font-mono text-muted-foreground text-xs">
                    {formatBytes(v.size)}
                  </span>
                  <span className="w-24 shrink-0 text-right text-muted-foreground text-xs">
                    {formatDate(v.publishedAt)}
                  </span>
                  <TakedownControls
                    takenDown={v.takedownReason !== null}
                    busy={busy === v.version}
                    onTakedown={(reason) => onAct(v.version, "takedown", reason)}
                    onRestore={() => onAct(v.version, "restore")}
                  />
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}
