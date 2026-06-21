import type { ReactNode } from "react";

export function Card({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      {children}
    </div>
  );
}

export function CardTitle({ children, icon }: Readonly<{ children: ReactNode; icon?: ReactNode }>) {
  return (
    <h2 className="flex items-center gap-2 font-bold font-heading text-base tracking-tight">
      {icon}
      {children}
    </h2>
  );
}

export function SideRow({
  label,
  value,
  mono,
}: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div className="flex items-center justify-between text-sm">
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
