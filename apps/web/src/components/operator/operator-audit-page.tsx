import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { GithubIcon } from "@/components/clay/icons";
import { Pager } from "@/components/clay/pagination";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { OperatorShell } from "@/components/operator/operator-shell";
import { OperatorHeader, SortSelect } from "@/components/operator/operator-toolbar";
import type { Pagination } from "@/lib/pagination";

const PAGE_SIZE = 25;
const route = getRouteApi("/operator/audit");
const GRID = "grid grid-cols-[160px_130px_1fr_150px] items-center gap-4 px-5";

/** The acting principal, snapshotted at write time (mirrors `@brika/registry-core`'s `Actor`). */
interface Actor {
  id: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  target: string | null;
  version: string | null;
  actor: Actor | null;
  detail: Record<string, unknown> | null;
  at: string;
}

interface AuditPage {
  items: AuditEntry[];
  pagination: Pagination;
  actions: string[];
}

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

export function OperatorAuditPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const [data, setData] = useState<AuditPage | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setData(null);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((search.page - 1) * PAGE_SIZE),
    });
    if (search.action) params.set("action", search.action);
    void fetch(`/api/operator/audit?${params}`).then(async (res) => {
      if (res.ok && id === reqId.current) setData((await res.json()) as AuditPage);
    });
  }, [search.page, search.action]);

  // Keep the selected type in the options even while a fetch is in flight (data momentarily null).
  const typeOptions = useMemo(() => {
    const set = new Set(data?.actions ?? []);
    if (search.action) set.add(search.action);
    return [
      { value: "all", label: "All types" },
      ...[...set].sort().map((action) => ({ value: action, label: action })),
    ];
  }, [data?.actions, search.action]);

  function renderRows() {
    if (data === null) {
      return <div className="px-5 py-4 text-muted-foreground text-sm">Loading…</div>;
    }
    if (data.items.length === 0) {
      return <div className="px-5 py-4 text-muted-foreground text-sm">No audit entries.</div>;
    }
    return data.items.map((e) => (
      <div
        key={e.id}
        className={`${GRID} border-border border-t py-3`}
        title={e.detail ? JSON.stringify(e.detail) : undefined}
      >
        <span className="text-muted-foreground text-xs">{whenLabel(e.at)}</span>
        <span>
          <span
            className={`rounded-full px-2.5 py-0.5 font-semibold text-xs ${
              isDestructive(e.action)
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {e.action}
          </span>
        </span>
        <span className="truncate font-mono text-foreground text-xs">
          {e.target ?? "·"}
          {e.version !== null && <span className="text-muted-foreground">@{e.version}</span>}
        </span>
        <ActorCell actor={e.actor} />
      </div>
    ));
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
