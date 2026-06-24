import { useEffect, useRef, useState } from "react";
import type { Pagination } from "@/lib/pagination";

const PAGE_SIZE = 25;

/** The acting principal, snapshotted at write time (mirrors `@brika/registry-core`'s `Actor`). */
export interface Actor {
  id: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  target: string | null;
  version: string | null;
  actor: Actor | null;
  detail: Record<string, unknown> | null;
  at: string;
}

export interface AuditPage {
  items: AuditEntry[];
  pagination: Pagination;
  actions: string[];
}

/**
 * The operator audit window for a page + optional action filter (`GET /api/operator/audit`): loads
 * `PAGE_SIZE` rows at the page's offset and returns the page (null while loading). A ref guards against
 * a stale in-flight response landing after the inputs changed.
 */
export function useOperatorAudit(page: number, action: string | undefined): AuditPage | null {
  const [data, setData] = useState<AuditPage | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setData(null);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (action) params.set("action", action);
    void fetch(`/api/operator/audit?${params}`).then(async (res) => {
      if (res.ok && id === reqId.current) setData((await res.json()) as AuditPage);
    });
  }, [page, action]);

  return data;
}
