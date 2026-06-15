import { cn } from "@brika/clay";
import { Star } from "lucide-react";

/** Five-star rating display, filled to the rounded average. */
export function Stars({
  value,
  className,
  starClassName = "size-3.5",
}: Readonly<{ value: number; className?: string; starClassName?: string }>) {
  const full = Math.round(value);
  return (
    <span data-slot="stars" className={cn("inline-flex gap-px", className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <Star
          key={index}
          className={cn(
            starClassName,
            index < full ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}
