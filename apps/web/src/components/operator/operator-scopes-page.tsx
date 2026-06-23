import { Input } from "@brika/clay";
import { Layers } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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

interface OperatorScope {
  scope: string;
  displayName: string | null;
  takedown: string | null;
  openReports: number;
}

type ScopeFacet = "all" | "review" | "takedown";
type ScopeSort = "newest" | "name" | "reports";

const FACET_PREDICATES: Record<ScopeFacet, (s: OperatorScope) => boolean> = {
  all: () => true,
  review: (s) => s.openReports > 0,
  takedown: (s) => s.takedown !== null,
};

export function OperatorScopesPage() {
  const list = useOperatorList<OperatorScope>("/api/operator/scopes");
  const [facet, setFacet] = useState<ScopeFacet>("all");
  const [sort, setSort] = useState<ScopeSort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const facets: Facet<ScopeFacet>[] = useMemo(
    () => [
      { key: "all", label: "All scopes", count: list.items.length },
      {
        key: "review",
        label: "Needs review",
        count: list.items.filter(FACET_PREDICATES.review).length,
      },
      {
        key: "takedown",
        label: "Taken down",
        count: list.items.filter(FACET_PREDICATES.takedown).length,
      },
    ],
    [list.items],
  );

  const visible = useMemo(() => {
    const sorted = list.items.filter(FACET_PREDICATES[facet]);
    if (sort === "name") sorted.sort((a, b) => a.scope.localeCompare(b.scope));
    else if (sort === "reports")
      sorted.sort((a, b) => b.openReports - a.openReports || a.scope.localeCompare(b.scope));
    return sorted; // "newest" keeps the server order
  }, [list.items, facet, sort]);

  // Scope the selection to what's on screen, so a facet/search change never takes down a scope the
  // operator can no longer see.
  const selectedScopes = useMemo(
    () => visible.filter((s) => selected.has(s.scope)).map((s) => s.scope),
    [visible, selected],
  );

  function toggle(scope: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  const act = useCallback(
    async (scope: string, path: string, body?: unknown) => {
      setBusy(scope);
      setError(null);
      const res = await fetch(`/api/operator/scopes/${encodeURIComponent(scope)}/${path}`, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      setBusy(null);
      if (res.ok) {
        list.reload();
        return;
      }
      const result: { error?: string } = await res.json();
      setError(result.error ?? "Action failed");
    },
    [list.reload],
  );

  const bulkTakedown = useCallback(
    async (reason: string) => {
      setBulkBusy(true);
      setError(null);
      const results = await Promise.all(
        selectedScopes.map((scope) =>
          fetch(`/api/operator/scopes/${encodeURIComponent(scope)}/takedown`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ reason }),
          }),
        ),
      );
      setBulkBusy(false);
      setSelected(new Set());
      list.reload();
      if (!results.every((r) => r.ok)) setError("Some scopes could not be taken down.");
    },
    [selectedScopes, list.reload],
  );

  function renderBody() {
    if (list.loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (visible.length === 0) {
      return <p className="text-muted-foreground text-sm">No scopes match.</p>;
    }
    return (
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {visible.map((scope) => (
          <li key={scope.scope} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={selected.has(scope.scope)}
              onChange={() => toggle(scope.scope)}
              aria-label={`Select ${scope.scope}`}
              className="size-4 shrink-0 cursor-pointer accent-brand"
            />
            <Layers className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium font-mono text-sm">{scope.scope}</span>
                {scope.openReports > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 text-xs dark:text-amber-400">
                    {scope.openReports} report{scope.openReports === 1 ? "" : "s"}
                  </span>
                )}
                {scope.takedown !== null && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
                    Taken down
                  </span>
                )}
              </div>
              <div className="truncate text-muted-foreground text-xs">
                {scope.takedown === null
                  ? (scope.displayName ?? "No display name")
                  : `Reason: ${scope.takedown}`}
              </div>
            </div>
            <TakedownControls
              takenDown={scope.takedown !== null}
              busy={busy === scope.scope}
              onTakedown={(reason) => act(scope.scope, "takedown", { reason })}
              onRestore={() => act(scope.scope, "restore")}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <OperatorShell activeLabel="Scopes">
      <OperatorHeader title="Scopes">
        Every scope on the registry. Filter the moderation queue or search to act on any scope.
        Taking one down withdraws it from public listings (its{" "}
        <span className="font-mono">/@scope</span> page 404s); the reason is recorded in the audit
        log.
      </OperatorHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FacetChips facets={facets} active={facet} onSelect={setFacet} />
        <SortSelect
          value={sort}
          onChange={setSort}
          options={[
            { value: "newest", label: "Newest" },
            { value: "reports", label: "Most reported" },
            { value: "name", label: "Name A–Z" },
          ]}
        />
      </div>

      <Input
        value={list.query}
        onChange={(e) => list.setQuery(e.target.value)}
        placeholder="Filter by scope or name"
        className="max-w-sm"
      />

      {list.capped && (
        <p className="text-muted-foreground text-xs">
          Showing the first {list.items.length} of {list.total}. Search to narrow.
        </p>
      )}
      {error !== null && <p className="text-destructive text-sm">{error}</p>}
      {selectedScopes.length > 0 && (
        <BulkBar
          count={selectedScopes.length}
          noun="scope"
          busy={bulkBusy}
          onTakedown={bulkTakedown}
          onClear={() => setSelected(new Set())}
        />
      )}

      {renderBody()}
    </OperatorShell>
  );
}
