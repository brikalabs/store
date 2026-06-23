import { Card } from "@brika/clay";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

/** Accent for the icon chip, keyed to the design's stat palette. */
type Accent = "brand" | "success" | "star";

const ACCENT: Record<Accent, string> = {
  brand: "bg-brand-tint text-brand-ink",
  success: "bg-success-tint text-success",
  star: "bg-warning-tint text-star",
};

/**
 * One overview stat: a colored icon chip, a label, and a big value (with an
 * optional trend). Renders as a card, or as a link tile when `to` is given.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  to,
}: Readonly<{
  label: string;
  value: string;
  icon: LucideIcon;
  accent: Accent;
  trend?: string;
  to?: string;
}>) {
  const body = (
    <>
      <span
        className={`flex size-[34px] items-center justify-center rounded-[10px] ${ACCENT[accent]}`}
      >
        <Icon className="size-[18px]" />
      </span>
      <div>
        <div className="font-semibold text-muted-foreground text-xs">{label}</div>
        <div className="mt-0.5 font-bold font-heading text-[27px] text-foreground leading-tight">
          {value}
          {trend ? (
            <span className="ml-1.5 font-semibold text-success text-xs">{trend}</span>
          ) : null}
        </div>
      </div>
    </>
  );
  const inner = "flex flex-col gap-3.5 px-[18px] py-[17px]";
  if (to !== undefined) {
    return (
      <Card className="rounded-[18px] p-0 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-border hover:shadow-md">
        <Link to={to} className={`${inner} text-left`}>
          {body}
        </Link>
      </Card>
    );
  }
  return <Card className={`${inner} rounded-[18px] shadow-sm`}>{body}</Card>;
}
