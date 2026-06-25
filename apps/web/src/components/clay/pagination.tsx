import { Button } from "@brika/clay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useT } from "@/i18n";
import { type Pagination, paginate } from "@/lib/pagination";

/**
 * Client-side slice of a list into the current page, returning the {@link Pagination} the
 * {@link Pager} consumes directly: `const { pageItems, pagination, setPage } = usePagedList(...)`.
 */
export function usePagedList<T>(
  items: readonly T[],
  pageSize: number,
): {
  pageItems: T[];
  pagination: Pagination;
  setPage: (page: number) => void;
} {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [rawPage, setRawPage] = useState(1);
  const page = Math.min(rawPage, totalPages); // stay in range when the list shrinks (e.g. filtering)
  const offset = (page - 1) * pageSize;
  const pageItems = useMemo(
    () => items.slice(offset, offset + pageSize),
    [items, offset, pageSize],
  );
  return {
    pageItems,
    setPage: setRawPage,
    pagination: paginate(total, { limit: pageSize, offset }),
  };
}

const stepClass =
  "h-[38px] gap-1.5 rounded-[10px] border border-input bg-card px-3.5 font-semibold text-sm hover:bg-card enabled:hover:border-brand-border enabled:hover:text-brand-ink disabled:opacity-45";

const navButton =
  "inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground outline-none transition-colors hover:border-brand/40 hover:text-foreground disabled:opacity-40";

/**
 * The compact pager: icon prev/next around a "current / total" count, for the grid and console
 * surfaces that want a minimal centered control rather than the full {@link Pager} bar. Driven by
 * the same {@link Pagination} object; renders nothing while the list fits on one page.
 */
export function PageNav({
  pagination,
  onPageChange,
  className,
}: Readonly<{
  pagination: Pagination;
  onPageChange: (page: number) => void;
  className?: string;
}>) {
  const t = useT();
  const { page, totalPages, hasPrev, hasNext } = pagination;
  if (totalPages <= 1) return null;
  return (
    <div className={`flex items-center justify-center gap-3 ${className ?? ""}`}>
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => onPageChange(page - 1)}
        className={navButton}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-muted-foreground text-sm tabular-nums">
        {t("clay:pagerShort", { current: page, total: totalPages })}
      </span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
        className={navButton}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/**
 * "Showing X-Y of Z · Prev / Page n / m / Next" pager bar driven by a single {@link Pagination}
 * object (from an endpoint envelope or {@link usePagedList}). Always shown once there are results;
 * the prev/next controls disable themselves at the ends.
 */
export function Pager({
  pagination,
  onPageChange,
}: Readonly<{
  pagination: Pagination;
  onPageChange: (page: number) => void;
}>) {
  const t = useT();
  const { page, totalPages, from, to, total, hasPrev, hasNext } = pagination;
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">
        {t("clay:pagerShowing")} <span className="font-semibold text-foreground">{from}</span>
        {"–"}
        <span className="font-semibold text-foreground">{to}</span> {t("clay:pagerOf")}{" "}
        <span className="font-semibold text-foreground">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={stepClass}
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          {t("clay:pagerPrevious")}
        </Button>
        <span className="px-1.5 text-muted-foreground text-sm">
          {t("clay:pagerPage")} <span className="font-bold text-foreground">{page}</span> /{" "}
          {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={stepClass}
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          {t("clay:pagerNext")}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
