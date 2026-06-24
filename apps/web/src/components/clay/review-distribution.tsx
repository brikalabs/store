import { cn, Rating } from "@brika/clay";

/** Average score beside a 5→1 star histogram. */
export function ReviewDistribution({
  average,
  count,
  distribution,
  className,
}: Readonly<{
  average: number;
  count: number;
  /** number of reviews at each star value, keyed 1..5 */
  distribution: Record<number, number>;
  className?: string;
}>) {
  const total = count > 0 ? count : 1;
  return (
    <div
      data-slot="review-distribution"
      className={cn(
        "flex items-center gap-6 rounded-2xl border border-border bg-card p-5",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-1 border-border border-r pr-6">
        <span className="font-bold font-heading text-4xl leading-none text-foreground">
          {average.toFixed(1)}
        </span>
        <Rating value={average} size="lg" color="var(--color-star)" />
        <span className="text-muted-foreground text-xs">
          {count} {count === 1 ? "review" : "reviews"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const pct = Math.round(((distribution[star] ?? 0) / total) * 100);
          return (
            <div
              key={star}
              className="flex items-center gap-2.5 font-mono text-muted-foreground text-xs"
            >
              {star}
              <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-9 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
