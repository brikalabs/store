import { useCallback, useEffect, useRef, useState } from "react";
import type { Pagination } from "@/lib/pagination";
import type { ReportReason } from "@/lib/reports";

const PAGE_SIZE = 20;

export interface OperatorReport {
  id: string;
  pluginName: string;
  pluginDisplayName: string | null;
  reason: string;
  details: string | null;
  reporter: { id: string; displayName: string; avatarUrl?: string };
  status: string;
  createdAt: string;
}

export interface ReportsPage {
  items: OperatorReport[];
  pagination: Pagination;
  counts: { open: number; resolved: number; dismissed: number };
}

/** The URL state the queue keys its fetch on (the route owns/validates this). */
export interface ReportsQuery {
  status: "open" | "resolved" | "dismissed" | "all";
  q?: string;
  reason?: ReportReason;
  page: number;
}

/**
 * The moderation-report queue data (server-paginated, keyed on the URL `query`): load the page and
 * resolve/dismiss a report, so the page stays presentational. A monotonic request id discards stale
 * responses, and a resolve/dismiss reloads on success to refresh both the list and the status counts;
 * a failure surfaces through `error`.
 */
export function useOperatorReports(query: ReportsQuery) {
  const [data, setData] = useState<ReportsPage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Fetch keyed on the URL state; a monotonic request id discards stale responses. `load` is also
  // called directly after a resolve/dismiss to refresh the list and the counts.
  const load = useCallback(() => {
    const id = ++reqId.current;
    setData(null);
    const params = new URLSearchParams({
      status: query.status,
      limit: String(PAGE_SIZE),
      offset: String((query.page - 1) * PAGE_SIZE),
    });
    if (query.q) params.set("q", query.q);
    if (query.reason) params.set("reason", query.reason);
    void fetch(`/api/operator/reports?${params}`).then(async (res) => {
      if (res.ok && id === reqId.current) setData((await res.json()) as ReportsPage);
    });
  }, [query.status, query.q, query.reason, query.page]);
  useEffect(load, [load]);

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

  return { data, busy, error, act };
}
