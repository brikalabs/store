import { Card, cn } from "@brika/clay";
import type { ReactNode } from "react";

/**
 * The dashboard settings-card shell: a rounded, bordered, padded surface. The single source for the
 * scope-settings cards and the plugin-manage sidebar cards (they previously re-spelled the same
 * className). Override the gap (or anything else) via `className`.
 */
export function SettingsCard({
  className,
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-3.5 rounded-[18px] border border-border bg-card p-[22px] shadow-sm",
        className,
      )}
    >
      {children}
    </Card>
  );
}

/** A label/value row for a settings sidebar (e.g. "License  MIT"), divided from the next. */
export function SideRow({
  label,
  value,
  mono,
}: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div className="flex items-center justify-between border-border border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          mono ? "font-semibold font-mono text-foreground" : "font-semibold text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
