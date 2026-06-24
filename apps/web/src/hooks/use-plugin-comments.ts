import { Comment } from "@brika/registry-contract";
import { useEffect, useState } from "react";
import { z } from "zod";

/**
 * The discussion data for a plugin: load the comment list (seeded from SSR `fallback`) and post a
 * comment or toggle an upvote, so the section stays presentational. A 401 surfaces a sign-in prompt
 * through `error`; `submit` resolves to whether the post succeeded (the form clears its input then).
 */
export function usePluginComments(pluginName: string, fallback: Comment[]) {
  const endpoint = `/v1/plugins/${encodeURIComponent(pluginName)}/comments`;
  const [comments, setComments] = useState<Comment[]>(fallback);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(endpoint)
      .then((res) => res.json())
      .then((json: unknown) => {
        const parsed = z.array(Comment).safeParse(json);
        if (active && parsed.success && parsed.data.length > 0) setComments(parsed.data);
      });
    return () => {
      active = false;
    };
  }, [endpoint]);

  async function vote(commentId: string) {
    const res = await fetch(`${endpoint}/${commentId}/vote`, { method: "POST" });
    if (res.status === 401) {
      setError("Please sign in to upvote comments.");
      return;
    }
    const parsed = z.array(Comment).safeParse(await res.json());
    if (parsed.success) setComments(parsed.data);
  }

  async function submit(body: string): Promise<boolean> {
    setSubmitting(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSubmitting(false);
    if (res.status === 401) {
      setError("Please sign in to comment.");
      return false;
    }
    if (!res.ok) {
      setError("Could not post your comment.");
      return false;
    }
    const parsed = z.array(Comment).safeParse(await res.json());
    if (parsed.success) {
      setComments(parsed.data);
      return true;
    }
    return false;
  }

  return { comments, submitting, error, vote, submit };
}
