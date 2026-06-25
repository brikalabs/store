import { Checkbox } from "@brika/clay/components/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@brika/clay/components/input-group";
import { CircleCheck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageNav, usePagedList } from "@/components/clay/pagination";
import { GradientAvatar } from "@/components/clay/plugin-icon";
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
import { useT } from "@/i18n";

interface OperatorScope {
  scope: string;
  displayName: string | null;
  takedown: string | null;
  verified: boolean;
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
  onVerify,
}: Readonly<{
  scope: OperatorScope;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onTakedown: (reason: string) => void;
  onRestore: () => void;
  onVerify: (verified: boolean) => void;
}>) {
  const t = useT();
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        aria-label={t("operator:selectScope", { scope: scope.scope })}
        className="shrink-0"
      />
      <GradientAvatar
        seed={scope.scope}
        label={scope.displayName ?? scope.scope}
        imageUrl={`/api/scopes/${encodeURIComponent(scope.scope)}/icon`}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium font-mono text-sm">{scope.scope}</span>
          {scope.openReports > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 text-xs dark:text-amber-400">
              {t("operator:scopeReports", { count: scope.openReports })}
            </span>
          )}
          {scope.takedown !== null && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
              {t("operator:takenDownBadge")}
            </span>
          )}
        </div>
        <div className="truncate text-muted-foreground text-xs">
          {scope.takedown === null
            ? (scope.displayName ?? t("operator:noDisplayName"))
            : t("operator:scopeReason", { reason: scope.takedown })}
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onVerify(!scope.verified)}
        title={scope.verified ? t("operator:verified") : t("operator:verify")}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-xs transition-colors disabled:opacity-50 ${
          scope.verified
            ? "bg-brand/10 text-brand-ink hover:bg-brand/20"
            : "border border-border text-muted-foreground hover:border-brand/40 hover:text-foreground"
        }`}
      >
        <CircleCheck className="size-3.5" />
        {scope.verified ? t("operator:verified") : t("operator:verify")}
      </button>
      <TakedownControls
        subject={scope.scope}
        takenDown={scope.takedown !== null}
        busy={busy}
        onTakedown={onTakedown}
        onRestore={onRestore}
      />
    </li>
  );
}

export function OperatorScopesPage() {
  const t = useT();
  const list = useOperatorList<OperatorScope>("/api/operator/scopes");
  const { busy, bulkBusy, error, act, bulkTakedown } = useOperatorScopeModeration(list.reload);
  const [facet, setFacet] = useState<ScopeFacet>("all");
  const [sort, setSort] = useState<ScopeSort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const facets: Facet<ScopeFacet>[] = useMemo(
    () => [
      { key: "all", label: t("operator:scopesFacetAll"), count: list.items.length },
      {
        key: "review",
        label: t("operator:scopesFacetReview"),
        count: list.items.filter(FACET_PREDICATES.review).length,
      },
      {
        key: "takedown",
        label: t("operator:scopesFacetTakedown"),
        count: list.items.filter(FACET_PREDICATES.takedown).length,
      },
    ],
    [list.items, t],
  );

  const visible = useMemo(() => {
    const sorted = list.items.filter(FACET_PREDICATES[facet]);
    if (sort === "name") sorted.sort((a, b) => a.scope.localeCompare(b.scope));
    else if (sort === "reports")
      sorted.sort((a, b) => b.openReports - a.openReports || a.scope.localeCompare(b.scope));
    return sorted; // "newest" keeps the server order
  }, [list.items, facet, sort]);

  const { pageItems, pagination, setPage } = usePagedList(visible, 20);

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
    if (list.loading)
      return <p className="text-muted-foreground text-sm">{t("operator:loading")}</p>;
    if (visible.length === 0) {
      return <p className="text-muted-foreground text-sm">{t("operator:scopesEmpty")}</p>;
    }
    return (
      <>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {pageItems.map((scope) => (
            <OperatorScopeRow
              key={scope.scope}
              scope={scope}
              selected={selected.has(scope.scope)}
              busy={busy === scope.scope}
              onToggle={() => toggle(scope.scope)}
              onTakedown={(reason) => act(scope.scope, "takedown", { reason })}
              onRestore={() => act(scope.scope, "restore")}
              onVerify={(verified) => act(scope.scope, "verify", { verified })}
            />
          ))}
        </ul>
        <PageNav pagination={pagination} onPageChange={setPage} className="pt-3" />
      </>
    );
  }

  return (
    <OperatorShell activeLabel="scopes">
      <OperatorHeader title={t("operator:scopesTitle")}>
        {t("operator:scopesIntroPrefix")}
        <span className="font-mono">/@scope</span>
        {t("operator:scopesIntroSuffix")}
      </OperatorHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FacetChips facets={facets} active={facet} onSelect={setFacet} />
        <SortSelect
          value={sort}
          onChange={setSort}
          options={[
            { value: "newest", label: t("operator:scopesSortNewest") },
            { value: "reports", label: t("operator:scopesSortReported") },
            { value: "name", label: t("operator:scopesSortName") },
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
          placeholder={t("operator:scopesSearchPlaceholder")}
        />
      </InputGroup>

      {list.capped && (
        <p className="text-muted-foreground text-xs">
          {t("operator:scopesCapped", { shown: list.items.length, total: list.total })}
        </p>
      )}
      {error !== null && <p className="text-destructive text-sm">{error}</p>}
      {selectedScopes.length > 0 && (
        <BulkBar
          count={selectedScopes.length}
          noun={t("operator:scopeNoun")}
          busy={bulkBusy}
          onTakedown={runBulkTakedown}
          onClear={() => setSelected(new Set())}
        />
      )}

      {renderBody()}
    </OperatorShell>
  );
}
