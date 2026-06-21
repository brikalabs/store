import type { Review } from "@brika/registry-contract";
import { Link } from "@tanstack/react-router";
import { MessageSquare, Star } from "lucide-react";
import { Stars } from "@/components/clay/stars";

/** A single authored review on the profile page: plugin link, stars, and body. */
export function ReviewRow({ review }: Readonly<{ review: Review }>) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          to="/$"
          params={{ _splat: review.pluginName }}
          className="font-semibold text-brand-ink text-sm hover:underline"
        >
          {review.pluginName}
        </Link>
        <span className="inline-flex items-center gap-1 text-amber-500">
          <Stars value={review.rating} starClassName="size-3.5" />
        </span>
        {review.helpfulCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
            <MessageSquare className="size-3.5" />
            {review.helpfulCount} found helpful
          </span>
        ) : null}
      </div>
      {review.title === undefined ? null : (
        <h3 className="flex items-center gap-1.5 font-semibold text-foreground">
          <Star className="size-3.5 text-amber-500" />
          {review.title}
        </h3>
      )}
      <p className="text-muted-foreground text-sm leading-relaxed">{review.body}</p>
    </article>
  );
}
