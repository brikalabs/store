import { Button, Input } from "@brika/clay";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pager } from "@/components/clay/pagination";
import { GradientAvatar, PluginIcon } from "@/components/clay/plugin-icon";
import { OperatorShell } from "@/components/operator/operator-shell";
import {
  type Facet,
  FacetChips,
  OperatorHeader,
  SortSelect,
} from "@/components/operator/operator-toolbar";
import { formatRelative } from "@/lib/format";
import type { Pagination } from "@/lib/pagination";
import { REPORT_REASON_KEYS, REPORT_REASONS, reportReasonLabel } from "@/lib/reports";

const PAGE_SIZE = 20;
const route = getRouteApi("/operator/reports");

interface OperatorReport {
  id: string;
  pluginName: string;
  pluginDisplayName: string | null;
  reason: string;
  details: string | null;
  reporter: { id: string; displayName: string; avatarUrl?: string };
  status: string;
  createdAt: string;
}

interface ReportsPage {
  items: OperatorReport[];
  pagination: Pagination;
  counts: { open: number; resolved: number; dismissed: number };
}

type StatusKey = "open" | "resolved" | "dismissed" | "all";

export function OperatorReportsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const [data, setData] = useState<ReportsPage | null>(null);
  const [text, setText] = useState(search.q ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Fetch keyed on the URL state; a monotonic request id discards stale responses. `load` is also
  // called directly after a resolve/dismiss to refresh the list and the counts.
  const load = useCallback(() => {
    const id = ++reqId.current;
    setData(null);
    const params = new URLSearchParams({
      status: search.status,
      limit: String(PAGE_SIZE),
      offset: String((search.page - 1) * PAGE_SIZE),
    });
    if (search.q) params.set("q", search.q);
    if (search.reason) params.set("reason", search.reason);
    void fetch(`/api/operator/reports?${params}`).then(async (res) => {
      if (res.ok && id === reqId.current) setData((await res.json()) as ReportsPage);
    });
  }, [search.status, search.q, search.reason, search.page]);
  useEffect(load, [load]);

  // Keep the box in sync when the URL `q` changes from outside (back/forward, cleared filters).
  useEffect(() => setText(search.q ?? ""), [search.q]);

  // Debounce the search box into the URL, returning to page 1 on a new query.
  useEffect(() => {
    const next = text.trim() || undefined;
    if (next === (search.q ?? undefined)) return;
    const id = setTimeout(() => {
      navigate({ search: (prev) => ({ ...prev, q: next, page: 1 }) });
    }, 300);
    return () => clearTimeout(id);
  }, [text, search.q, navigate]);

  const act = useCallback(
    async (id: string, status: "resolved" | "dismissed") => {
      setBusy(id);
      setError(null);
      const res = await fetch("/api/operator/reports/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setBusy(null);
      if (res.ok) {
        load();
        return;
      }
      const result: { error?: string } = await res.json();
      setError(result.error ?? "Action failed");
    },
    [load],
  );

  const counts = data?.counts;
  const statusFacets: Facet<StatusKey>[] = [
    { key: "open", label: "Open", count: counts?.open ?? 0 },
    { key: "resolved", label: "Resolved", count: counts?.resolved ?? 0 },
    { key: "dismissed", label: "Dismissed", count: counts?.dismissed ?? 0 },
    {
      key: "all",
      label: "All",
      count: counts ? counts.open + counts.resolved + counts.dismissed : 0,
    },
  ];

  const filtered =
    search.q !== undefined || search.reason !== undefined || search.status !== "open";

  function renderBody() {
    if (data === null) return <p className="text-muted-foreground text-sm">Loading…</p>;
    if (data.items.length === 0) {
      return (
        <p className="text-muted-foreground text-sm">
          {filtered ? "No reports match these filters." : "No open reports. The queue is clear."}
        </p>
      );
    }
    return (
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {data.items.map((report) => (
          <li
            key={report.id}
            className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start"
          >
            <PluginIcon name={report.pluginName} size={36} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/$"
                  params={{ _splat: report.pluginName }}
                  className="truncate font-medium font-mono text-sm hover:underline"
                >
                  {report.pluginName}
                </Link>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 text-xs dark:text-amber-400">
                  {reportReasonLabel(report.reason)}
                </span>
                {report.status !== "open" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs capitalize">
                    {report.status}
                  </span>
                )}
              </div>
              {report.details !== null && report.details.length > 0 ? (
                <p className="text-foreground text-sm leading-relaxed">{report.details}</p>
              ) : (
                <p className="text-muted-foreground text-sm italic">No details provided.</p>
              )}
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <GradientAvatar
                  seed={report.reporter.id}
                  label={report.reporter.displayName}
                  imageUrl={report.reporter.avatarUrl}
                  size={18}
                  round
                />
                <span>{report.reporter.displayName}</span>
                <span aria-hidden>·</span>
                <span>{formatRelative(report.createdAt)}</span>
              </div>
            </div>
            {report.status === "open" && (
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === report.id}
                  onClick={() => act(report.id, "dismissed")}
                >
                  <X className="size-4" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  disabled={busy === report.id}
                  onClick={() => act(report.id, "resolved")}
                >
                  <Check className="size-4" />
                  Resolve
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <OperatorShell activeLabel="Reports">
      <OperatorHeader title="Reports">
        User-submitted moderation reports. Filter by status or reason, or search a plugin, reporter,
        or the report text. Resolve once you've acted (e.g. taken the package down), or dismiss a
        report that needs no action. Either choice is recorded in the audit log.
      </OperatorHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FacetChips
          facets={statusFacets}
          active={search.status}
          onSelect={(status) => navigate({ search: (prev) => ({ ...prev, status, page: 1 }) })}
        />
        <SortSelect
          label="Reason"
          value={search.reason ?? "all"}
          options={[
            { value: "all", label: "All reasons" },
            ...REPORT_REASON_KEYS.map((key) => ({ value: key, label: REPORT_REASONS[key].label })),
          ]}
          onChange={(value) =>
            navigate({
              search: (prev) => ({
                ...prev,
                reason: REPORT_REASON_KEYS.find((key) => key === value),
                page: 1,
              }),
            })
          }
        />
      </div>

      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search plugin, reporter, or details"
        className="max-w-sm"
      />

      {error !== null && <p className="text-destructive text-sm">{error}</p>}

      {renderBody()}

      {data && (
        <Pager
          pagination={data.pagination}
          onPageChange={(page) => navigate({ search: (prev) => ({ ...prev, page }) })}
        />
      )}
    </OperatorShell>
  );
}
