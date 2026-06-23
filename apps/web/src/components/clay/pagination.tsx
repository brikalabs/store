import { Button } from "@brika/clay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

/** Client-side slice of a list into the current page, with the controls a {@link Pager} needs. */
export function usePagedList<T>(
  items: readonly T[],
  pageSize: number,
): {
  page: number;
  pages: number;
  pageItems: T[];
  from: number;
  to: number;
  total: number;
  setPage: (page: number) => void;
} {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const [rawPage, setRawPage] = useState(1);
  const page = Math.min(rawPage, pages); // stay in range when the list shrinks (e.g. filtering)
  const start = (page - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);
  return {
    page,
    pages,
    pageItems,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    setPage: setRawPage,
  };
}

const stepClass =
  "h-[38px] gap-1.5 rounded-[10px] border border-input bg-card px-3.5 font-semibold text-sm hover:bg-card enabled:hover:border-brand-border enabled:hover:text-brand-ink disabled:opacity-45";

/**
 * "Showing X-Y of Z · Prev / Page n / m / Next" pager bar. Always shown once there
 * are results (the count line is useful even on a single page); the prev/next
 * controls disable themselves at the ends.
 */
export function Pager({
  page,
  pages,
  from,
  to,
  total,
  noun,
  onChange,
}: Readonly<{
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  noun: string;
  onChange: (page: number) => void;
}>) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">
        Showing <span className="font-semibold text-foreground">{from}</span>
        {"–"}
        <span className="font-semibold text-foreground">{to}</span> of{" "}
        <span className="font-semibold text-foreground">{total}</span> {noun}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={stepClass}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="px-1.5 text-muted-foreground text-sm">
          Page <span className="font-bold text-foreground">{page}</span> / {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={stepClass}
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
