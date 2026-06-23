import { Card } from "@brika/clay";
import { Ban } from "lucide-react";
import type { ReactNode } from "react";

/** The red "Danger zone" card shell: a heading over one or more {@link DangerRow}s (and any error). */
export function DangerZone({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Card className="flex flex-col gap-3.5 rounded-[20px] border-danger-border bg-danger-tint p-[22px] shadow-none">
      <h2 className="flex items-center gap-2.5 font-bold font-heading text-foreground text-lg tracking-tight">
        <Ban className="size-[18px] text-danger" />
        Danger zone
      </h2>
      {children}
    </Card>
  );
}

/** One irreversible action: a title + description on the left, the (confirm-wired) button on the right. */
export function DangerRow({
  title,
  description,
  action,
}: Readonly<{ title: string; description: ReactNode; action: ReactNode }>) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-60 flex-1">
        <div className="font-bold text-foreground text-sm">{title}</div>
        <div className="text-[13px] text-muted-foreground leading-relaxed">{description}</div>
      </div>
      {action}
    </div>
  );
}
