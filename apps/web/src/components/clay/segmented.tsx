import { cn } from "@brika/clay";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SegmentOption<T extends string> = { value: T; label: string; icon?: LucideIcon };

/**
 * A raised-pill segmented control (the look Clay's default TabsList uses): the
 * single source for the dashboard's theme switch and the My-plugins status
 * filter. For tab-like controls that own panels, use Clay's <Tabs> instead.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fill = true,
  ariaLabel,
  className,
}: Readonly<{
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  fill?: boolean;
  ariaLabel?: string;
  className?: string;
}>) {
  return (
    <fieldset
      className={cn(
        "m-0 inline-flex min-w-0 gap-1 rounded-xl border border-border bg-muted p-1",
        fill && "w-full",
        className,
      )}
    >
      <legend className="sr-only">{ariaLabel}</legend>
      {options.map(({ value: optionValue, label, icon: Icon }) => {
        const active = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(optionValue)}
            className={cn(
              // min-w-0 lets flex-1 segments shrink below their content so the control never
              // overflows a narrow container (e.g. the account menu's Light/Dark/System).
              "inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 font-semibold text-xs transition-colors [&_svg]:size-3.5",
              fill && "flex-1",
              active
                ? "bg-card text-brand-ink shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon /> : null}
            {label}
          </button>
        );
      })}
    </fieldset>
  );
}

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
