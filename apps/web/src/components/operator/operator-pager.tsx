import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";

/** Page size for the operator console lists (client-side paging over the loaded window). */
const OPERATOR_PAGE_SIZE = 20;

/**
 * Client-side paging over an already-loaded list. Clamps the current page so a shrinking filter
 * never strands an empty page; the returned `page` is already clamped, ready for {@link OperatorPager}.
 */
export function useClientPage<T>(items: readonly T[]): {
  page: number;
  setPage: (page: number) => void;
  pageCount: number;
  pageItems: T[];
} {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / OPERATOR_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = items.slice(safePage * OPERATOR_PAGE_SIZE, (safePage + 1) * OPERATOR_PAGE_SIZE);
  return { page: safePage, setPage, pageCount, pageItems };
}

/** Prev / next paging for an operator console list; renders nothing when it fits on one page. */
export function OperatorPager({
  page,
  pageCount,
  onPage,
}: Readonly<{ page: number; pageCount: number; onPage: (page: number) => void }>) {
  const t = useT();
  if (pageCount <= 1) return null;
  const btn =
    "inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground outline-none transition-colors hover:border-brand/40 hover:text-foreground disabled:opacity-40";
  return (
    <div className="flex items-center justify-center gap-3 pt-3">
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className={btn}>
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-muted-foreground text-sm tabular-nums">
        {t("plugin:pageOf", { current: page + 1, total: pageCount })}
      </span>
      <button
        type="button"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
        className={btn}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
