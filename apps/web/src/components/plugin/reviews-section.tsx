import { Input, Rating, Textarea } from "@brika/clay";
import type { Review } from "@brika/registry-contract";
import { Heart, Star } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { ReviewDistribution } from "@/components/clay/review-distribution";
import { SignInToParticipate, SubmitRow } from "@/components/plugin/participation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePluginReviews } from "@/hooks/use-plugin-reviews";
import { useDateFormat, useT } from "@/i18n";

/** One review: the author, their stars, the body, and a helpful-vote toggle. */
function ReviewItem({
  review,
  canVote,
  onVote,
}: Readonly<{ review: Review; canVote: boolean; onVote: () => void }>) {
  const t = useT();
  const date = useDateFormat();
  return (
    <article className="flex gap-3">
      <GradientAvatar
        seed={review.author.id}
        label={review.author.displayName}
        imageUrl={review.author.avatarUrl}
        size={38}
        className="rounded-[10px]"
      />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground text-sm">{review.author.displayName}</span>
          <Rating value={review.rating} color="var(--color-star)" />
          {review.versionReviewed ? (
            <span className="font-mono text-muted-foreground text-xs">
              v{review.versionReviewed}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">{date(review.createdAt)}</span>
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
            onClick={onVote}
            disabled={!canVote}
            aria-pressed={review.viewerVotedHelpful}
            className={
              review.viewerVotedHelpful
                ? "inline-flex items-center gap-1.5 text-rose-500 text-xs"
                : "inline-flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground disabled:hover:text-muted-foreground"
            }
          >
            <Heart className={review.viewerVotedHelpful ? "size-3.5 fill-rose-500" : "size-3.5"} />
            {review.helpfulCount > 0
              ? t("plugin:helpfulCount", { count: review.helpfulCount })
              : t("plugin:helpful")}
          </button>
        </div>
      </div>
    </article>
  );
}

type Props = Readonly<{ pluginName: string; fallback?: Review[] }>;

export function ReviewsSection({ pluginName, fallback = [] }: Props) {
  const t = useT();
  const { user } = useCurrentUser();
  const { reviews, average, distribution, submitting, error, vote, submit } = usePluginReviews(
    pluginName,
    fallback,
  );
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim().length === 0) return;
    const result = await submit({ rating, title, body });
    if (result.ok) {
      setTitle("");
      setBody("");
    }
  }

  return (
    <section id="reviews" className="flex flex-col gap-4 scroll-mt-20">
      <h2 className="font-bold font-heading text-xl tracking-tight">{t("plugin:reviews")}</h2>

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
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={t("plugin:starsLabel", { count: n })}
              >
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
            placeholder={t("plugin:reviewTitlePlaceholder")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Textarea
            placeholder={t("plugin:reviewBodyPlaceholder")}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
          />
          <SubmitRow
            error={error}
            submitting={submitting}
            busyLabel={t("plugin:reviewSubmitting")}
            submitLabel={t("plugin:reviewSubmit")}
          />
        </form>
      ) : (
        <SignInToParticipate>{t("plugin:reviewSignIn")}</SignInToParticipate>
      )}

      <div className="flex flex-col gap-5">
        {reviews.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("plugin:noReviews")}</p>
        ) : null}
        {reviews.map((review) => (
          <ReviewItem
            key={review.id}
            review={review}
            canVote={review.author.id !== user?.id}
            onVote={() => vote(review.id)}
          />
        ))}
      </div>
    </section>
  );
}
