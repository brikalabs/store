import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import { GithubIcon } from "@/components/clay/icons";
import { Pager } from "@/components/clay/pagination";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { OperatorShell } from "@/components/operator/operator-shell";
import { OperatorHeader, SortSelect } from "@/components/operator/operator-toolbar";
import { type Actor, type AuditEntry, useOperatorAudit } from "@/hooks/use-operator-audit";

const route = getRouteApi("/operator/audit");
const GRID = "grid grid-cols-[160px_130px_1fr_150px] items-center gap-4 px-5";

/** A takedown/removal action reads as destructive; everything else is neutral. */
function isDestructive(action: string): boolean {
  return action.includes("takedown") || action.includes("remove") || action === "yank";
}

/** "Apr 12, 14:08" - matches the design's compact timestamp. */
function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * The actor as snapshotted on the row: a human shows their avatar + display name; a CI/OIDC publish
 * (no account) shows its `owner/repo` on a dark GitHub tile; an empty row shows `·`.
 */
function ActorCell({ actor }: { readonly actor: Actor | null }) {
  if (actor === null || (actor.id === null && actor.displayName === null)) {
    return <span className="text-muted-foreground text-xs">·</span>;
  }
  if (actor.id === null) {
    return (
      <span className="flex items-center gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <GithubIcon className="size-3" />
        </span>
        <span className="truncate font-mono text-muted-foreground text-xs">
          {actor.displayName}
        </span>
      </span>
    );
  }
  const label = actor.displayName ?? actor.id;
  return (
    <span className="flex items-center gap-2">
      <GradientAvatar seed={actor.id} label={label} imageUrl={actor.avatarUrl} size={20} round />
      <span className="truncate text-foreground text-sm">{label}</span>
    </span>
  );
}

/** One audit row: when, the action pill (destructive vs neutral), the target@version, and the actor. */
function AuditRow({ entry }: { readonly entry: AuditEntry }) {
  return (
    <div
      className={`${GRID} border-border border-t py-3`}
      title={entry.detail ? JSON.stringify(entry.detail) : undefined}
    >
      <span className="text-muted-foreground text-xs">{whenLabel(entry.at)}</span>
      <span>
        <span
          className={`rounded-full px-2.5 py-0.5 font-semibold text-xs ${
            isDestructive(entry.action)
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {entry.action}
        </span>
      </span>
      <span className="truncate font-mono text-foreground text-xs">
        {entry.target ?? "·"}
        {entry.version !== null && <span className="text-muted-foreground">@{entry.version}</span>}
      </span>
      <ActorCell actor={entry.actor} />
    </div>
  );
}

export function OperatorAuditPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const data = useOperatorAudit(search.page, search.action);

  // Keep the selected type in the options even while a fetch is in flight (data momentarily null).
  const typeOptions = useMemo(() => {
    const set = new Set(data?.actions ?? []);
    if (search.action) set.add(search.action);
    return [
      { value: "all", label: "All types" },
      ...[...set]
        .sort((a, b) => a.localeCompare(b))
        .map((action) => ({ value: action, label: action })),
    ];
  }, [data?.actions, search.action]);

  function renderRows() {
    if (data === null) {
      return <div className="px-5 py-4 text-muted-foreground text-sm">Loading…</div>;
    }
    if (data.items.length === 0) {
      return <div className="px-5 py-4 text-muted-foreground text-sm">No audit entries.</div>;
    }
    return data.items.map((e) => <AuditRow key={e.id} entry={e} />);
  }

  return (
    <OperatorShell activeLabel="Audit log">
      <OperatorHeader title="Audit log">
        Every registry action (publishes, takedowns, member and domain changes), newest first.
      </OperatorHeader>

      <div className="flex flex-wrap items-center gap-3">
        <SortSelect
          label="Type"
          value={search.action ?? "all"}
          options={typeOptions}
          onChange={(value) =>
            navigate({
              search: (prev) => ({
                ...prev,
                action: value === "all" ? undefined : value,
                page: 1,
              }),
            })
          }
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <div className="min-w-[680px]">
          <div
            className={`${GRID} bg-muted/40 py-2.5 font-bold text-[11px] text-muted-foreground uppercase tracking-[0.06em]`}
          >
            <div>When</div>
            <div>Action</div>
            <div>Target</div>
            <div>Actor</div>
          </div>
          {renderRows()}
        </div>
      </div>

      {data && (
        <Pager
          pagination={data.pagination}
          onPageChange={(page) => navigate({ search: (prev) => ({ ...prev, page }) })}
        />
      )}
    </OperatorShell>
  );
}
