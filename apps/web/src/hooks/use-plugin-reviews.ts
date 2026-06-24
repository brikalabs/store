import { Review } from "@brika/registry-contract";
import { useEffect, useState } from "react";
import { z } from "zod";

/** The result of writing a review: success clears the form, the failure modes drive distinct copy. */
export type SubmitResult = { ok: true } | { ok: false; reason: "auth" | "error" };

/**
 * The reviews data for a plugin's reviews section: load the list (seeded by `fallback`), vote on a
 * review, and submit a new one, so the section stays presentational. The list reloads from each
 * mutation's response; `vote` reports a sign-in requirement via `error`, `submit` returns a typed
 * result so the form can clear its inputs and pick the right message.
 */
export function usePluginReviews(pluginName: string, fallback: Review[]) {
  const endpoint = `/v1/plugins/${encodeURIComponent(pluginName)}/reviews`;
  const [reviews, setReviews] = useState<Review[]>(fallback);
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

  async function vote(reviewId: string) {
    const res = await fetch(`${endpoint}/${reviewId}/vote`, { method: "POST" });
    if (res.status === 401) {
      setError("Please sign in to vote on reviews.");
      return;
    }
    const parsed = z.array(Review).safeParse(await res.json());
    if (parsed.success) setReviews(parsed.data);
  }

  async function submit(input: {
    rating: number;
    title: string;
    body: string;
  }): Promise<SubmitResult> {
    setSubmitting(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rating: input.rating,
        title: input.title.trim() || undefined,
        body: input.body.trim(),
      }),
    });
    setSubmitting(false);
    if (res.status === 401) {
      setError("Please sign in to write a review.");
      return { ok: false, reason: "auth" };
    }
    if (!res.ok) {
      setError("Could not submit your review.");
      return { ok: false, reason: "error" };
    }
    const parsed = z.array(Review).safeParse(await res.json());
    if (parsed.success) setReviews(parsed.data);
    return { ok: true };
  }

  return { reviews, average, distribution, submitting, error, vote, submit };
}
