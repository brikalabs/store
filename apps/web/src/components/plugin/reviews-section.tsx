import { Button, Input, Textarea } from "@brika/clay";
import { Review } from "@brika/registry-contract";
import { Heart, Star } from "lucide-react";
import { type SyntheticEvent, useEffect, useState } from "react";
import { z } from "zod";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { ReviewDistribution } from "@/components/clay/review-distribution";
import { Stars } from "@/components/clay/stars";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDate } from "@/lib/format";

type Props = Readonly<{ pluginName: string; fallback?: Review[] }>;

export function ReviewsSection({ pluginName, fallback = [] }: Props) {
  const { user } = useCurrentUser();
  const endpoint = `/v1/plugins/${encodeURIComponent(pluginName)}/reviews`;
  const [reviews, setReviews] = useState<Review[]>(fallback);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(endpoint)
      .then((res) => res.json())
      .then((json: unknown) => {
        const parsed = z.array(Review).safeParse(json);
        if (active && parsed.success && parsed.data.length > 0) setReviews(parsed.data);
      });
    return () => {
      active = false;
    };
  }, [endpoint]);

  const average =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const distribution = reviews.reduce<Record<number, number>>((acc, r) => {
    acc[r.rating] = (acc[r.rating] ?? 0) + 1;
    return acc;
  }, {});

  async function handleVote(reviewId: string) {
    const res = await fetch(`${endpoint}/${reviewId}/vote`, { method: "POST" });
    if (res.status === 401) {
      setError("Please sign in to vote on reviews.");
      return;
    }
    const parsed = z.array(Review).safeParse(await res.json());
    if (parsed.success) setReviews(parsed.data);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, title: title.trim() || undefined, body: body.trim() }),
    });
    setSubmitting(false);
    if (res.status === 401) {
      setError("Please sign in to write a review.");
      return;
    }
    if (!res.ok) {
      setError("Could not submit your review.");
      return;
    }
    const parsed = z.array(Review).safeParse(await res.json());
    if (parsed.success) {
      setReviews(parsed.data);
      setTitle("");
      setBody("");
    }
  }

  return (
    <section id="reviews" className="flex flex-col gap-4 scroll-mt-20">
      <h2 className="font-bold font-heading text-xl tracking-tight">Reviews</h2>

      {reviews.length > 0 ? (
        <ReviewDistribution average={average} count={reviews.length} distribution={distribution} />
      ) : null}

      {user ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star
                  className={
                    n <= rating
                      ? "size-6 fill-amber-500 text-amber-500"
                      : "size-6 text-muted-foreground/40"
                  }
                />
              </button>
            ))}
          </div>
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            placeholder="Share how this plugin works for you"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit review"}
            </Button>
          </div>
        </form>
      ) : (
        <a
          href="/auth/github"
          className="rounded-2xl border border-border border-dashed p-4 text-center text-muted-foreground text-sm hover:text-foreground"
        >
          Sign in with GitHub to write a review
        </a>
      )}

      <div className="flex flex-col gap-5">
        {reviews.length === 0 ? (
          <p className="text-muted-foreground text-sm">No reviews yet. Be the first to review.</p>
        ) : null}
        {reviews.map((review) => (
          <article key={review.id} className="flex gap-3">
            <GradientAvatar
              seed={review.author.id}
              label={review.author.displayName}
              imageUrl={review.author.avatarUrl}
              size={38}
              className="rounded-[10px]"
            />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground text-sm">
                  {review.author.displayName}
                </span>
                <Stars value={review.rating} />
                {review.versionReviewed ? (
                  <span className="font-mono text-muted-foreground text-xs">
                    v{review.versionReviewed}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {formatDate(review.createdAt)}
                  </span>
                )}
              </div>
              {review.title ? (
                <p className="text-foreground text-sm leading-relaxed">
                  <strong className="font-semibold">{review.title}.</strong> {review.body}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm leading-relaxed">{review.body}</p>
              )}
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => handleVote(review.id)}
                  disabled={review.author.id === user?.id}
                  aria-pressed={review.viewerVotedHelpful}
                  className={
                    review.viewerVotedHelpful
                      ? "inline-flex items-center gap-1.5 text-rose-500 text-xs"
                      : "inline-flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground disabled:hover:text-muted-foreground"
                  }
                >
                  <Heart
                    className={review.viewerVotedHelpful ? "size-3.5 fill-rose-500" : "size-3.5"}
                  />
                  {review.helpfulCount > 0
                    ? `${review.helpfulCount} found this helpful`
                    : "Helpful"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
