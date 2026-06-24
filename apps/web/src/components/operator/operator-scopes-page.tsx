import { Checkbox } from "@brika/clay/components/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@brika/clay/components/input-group";
import { Layers, Search } from "lucide-react";
import { useMemo, useState } from "react";
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
import { useOperatorScopeModeration } from "@/hooks/use-operator-scope-moderation";

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

/** One scope row: a select checkbox, name with report/takedown badges, and the takedown controls. */
function OperatorScopeRow({
  scope,
  selected,
  busy,
  onToggle,
  onTakedown,
  onRestore,
}: Readonly<{
  scope: OperatorScope;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onTakedown: (reason: string) => void;
  onRestore: () => void;
}>) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        aria-label={`Select ${scope.scope}`}
        className="shrink-0"
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
        busy={busy}
        onTakedown={onTakedown}
        onRestore={onRestore}
      />
    </li>
  );
}

export function OperatorScopesPage() {
  const list = useOperatorList<OperatorScope>("/api/operator/scopes");
  const { busy, bulkBusy, error, act, bulkTakedown } = useOperatorScopeModeration(list.reload);
  const [facet, setFacet] = useState<ScopeFacet>("all");
  const [sort, setSort] = useState<ScopeSort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  // Clear the selection once the bulk run settles, matching the pre-hook ordering (the selection
  // stays highlighted while the takedowns are in flight).
  function runBulkTakedown(reason: string) {
    void bulkTakedown(selectedScopes, reason).then(() => setSelected(new Set()));
  }

  function renderBody() {
    if (list.loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (visible.length === 0) {
      return <p className="text-muted-foreground text-sm">No scopes match.</p>;
    }
    return (
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {visible.map((scope) => (
          <OperatorScopeRow
            key={scope.scope}
            scope={scope}
            selected={selected.has(scope.scope)}
            busy={busy === scope.scope}
            onToggle={() => toggle(scope.scope)}
            onTakedown={(reason) => act(scope.scope, "takedown", { reason })}
            onRestore={() => act(scope.scope, "restore")}
          />
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

      <InputGroup className="max-w-sm">
        <InputGroupAddon align="inline-start">
          <Search className="size-4 text-muted-foreground" />
        </InputGroupAddon>
        <InputGroupInput
          value={list.query}
          onChange={(e) => list.setQuery(e.target.value)}
          placeholder="Filter by scope or name"
        />
      </InputGroup>

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
          onTakedown={runBulkTakedown}
          onClear={() => setSelected(new Set())}
        />
      )}

      {renderBody()}
    </OperatorShell>
  );
}
