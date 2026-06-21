import { Card } from "@brika/clay/components/card";
import { Chart } from "@brika/clay/components/chart";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatCount } from "@/lib/format";
import { cumulativePoints, weekTrend } from "./helpers";

/** Green/red trend pill with a directional arrow, matching the design. */
function TrendPill({ trend }: Readonly<{ trend: number }>) {
  const up = trend >= 0;
  return (
    <span
      className={
        up
          ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600 text-xs dark:text-emerald-400"
          : "inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-600 text-xs dark:text-rose-400"
      }
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {trend}%
    </span>
  );
}

/**
 * Total-downloads card with a real install trend, drawn with the Clay chart kit.
 * Shown only when the registry has install history (npm carries no per-day series).
 */
export function DownloadsCard({
  installs,
  weekly,
  series,
  since,
}: Readonly<{ installs: number; weekly: number; series: number[]; since?: string }>) {
  const trend = weekTrend(series);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
            Total downloads
          </span>
          <span className="font-bold font-heading text-2xl text-foreground leading-tight">
            {formatCount(installs)}
          </span>
        </div>
        {trend === 0 ? null : <TrendPill trend={trend} />}
      </div>
      <div className="h-24">
        <Chart
          data={cumulativePoints(series)}
          color="var(--color-brand)"
          formatValue={formatCount}
          formatX={(ts) => `Day ${Math.round(ts) + 1}`}
        />
      </div>
      <div className="flex justify-between font-mono text-muted-foreground text-xs">
        <span>{formatCount(weekly)} this week</span>
        <span>{since ? `since ${since}` : "last 30 days"}</span>
      </div>
    </Card>
  );
}
