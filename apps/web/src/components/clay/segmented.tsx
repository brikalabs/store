import { cn } from "@brika/clay";
import type { ReactNode } from "react";

/** Pill container for a segmented control (Spotlight/Console, locale switch). */
export function Segmented({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      data-slot="segmented"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-border bg-muted p-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** className for one segment; works on a `<button>` or a router `<Link>`. */
export function segmentClassName(active: boolean, size: "sm" | "md" = "md"): string {
  const base =
    size === "sm"
      ? "rounded-lg px-2.5 py-1 font-mono font-semibold text-[11.5px] transition-colors"
      : "rounded-lg px-4 py-1.5 font-semibold text-xs transition-colors";
  return cn(
    base,
    active
      ? "bg-brand text-brand-foreground"
      : "bg-transparent text-muted-foreground hover:text-foreground",
  );
}
