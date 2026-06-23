import { cn } from "@brika/clay";
import type { ReactNode } from "react";

/** Accent for a status/role pill, keyed to the design's tint palette. */
export type PillTone = "brand" | "success" | "warning" | "danger" | "muted";

const FILL: Record<PillTone, string> = {
  brand: "bg-brand-tint text-brand-ink",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  muted: "bg-accent text-muted-foreground",
};

const BORDER: Record<PillTone, string> = {
  brand: "border border-brand-border",
  success: "border border-success-border",
  warning: "border border-warning-border",
  danger: "border border-danger-border",
  muted: "border border-input",
};

/**
 * A rounded-full status/role pill: one tinted accent + an optional leading dot. The single source
 * for the status badges, role chips, and Verified/Pending markers that were hand-rolled per file.
 */
export function Pill({
  tone = "muted",
  dot = false,
  border = false,
  size = "md",
  className,
  children,
}: Readonly<{
  tone?: PillTone;
  dot?: boolean;
  border?: boolean;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        FILL[tone],
        border && BORDER[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
