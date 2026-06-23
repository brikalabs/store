import { cn } from "@brika/clay";
import type { ReactNode } from "react";

/**
 * The danger-tinted error banner the dashboard pages/cards show above a failed action. Renders
 * nothing when there's no message, so callers can drop the `error !== null ?` guard. `size="sm"`
 * is the in-card variant; the default is the page-level banner.
 */
export function ErrorBanner({
  children,
  size = "md",
  className,
}: Readonly<{ children?: ReactNode; size?: "sm" | "md"; className?: string }>) {
  if (!children) return null;
  return (
    // div (not p) so callers may pass block content, and role=alert announces the error.
    <div
      role="alert"
      className={cn(
        "border border-danger-border bg-danger-tint text-danger",
        size === "sm" ? "rounded-[10px] px-3 py-2 text-xs" : "rounded-[11px] px-4 py-3 text-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
