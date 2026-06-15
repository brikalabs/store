import { Button, Textarea } from "@brika/clay";
import { Comment } from "@brika/registry-contract";
import { type FormEvent, useEffect, useState } from "react";
import { z } from "zod";
import { formatDate } from "../lib/format";
import { useCurrentUser } from "../lib/use-current-user";
import { GradientAvatar } from "./clay/plugin-icon";

type Props = Readonly<{ pluginName: string; fallback?: Comment[] }>;

export function CommentsSection({ pluginName, fallback = [] }: Props) {
  const { user } = useCurrentUser();
  const endpoint = `/v1/plugins/${encodeURIComponent(pluginName)}/comments`;
  const [comments, setComments] = useState<Comment[]>(fallback);
  const [body, setBody] = useState("");
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });
    setSubmitting(false);
    if (res.status === 401) {
      setError("Please sign in to comment.");
      return;
    }
    if (!res.ok) {
      setError("Could not post your comment.");
      return;
    }
    const parsed = z.array(Comment).safeParse(await res.json());
    if (parsed.success) {
      setComments(parsed.data);
      setBody("");
    }
  }

  return (
    <section id="discussion" className="flex flex-col gap-4 scroll-mt-20">
      <h2 className="font-bold font-heading text-xl tracking-tight">Discussion</h2>

      {user ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <Textarea
            placeholder="Ask a question or share a tip"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Posting..." : "Post comment"}
            </Button>
          </div>
        </form>
      ) : (
        <a
          href="/auth/github"
          className="rounded-2xl border border-border border-dashed p-4 text-center text-muted-foreground text-sm hover:text-foreground"
        >
          Sign in with GitHub to join the discussion
        </a>
      )}

      <div className="flex flex-col gap-5">
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No comments yet.</p>
        ) : (
          comments
            .filter((comment) => !comment.parentId)
            .map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                replies={comments.filter((reply) => reply.parentId === comment.id)}
              />
            ))
        )}
      </div>
    </section>
  );
}

function CommentMeta({ comment }: Readonly<{ comment: Comment }>) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-foreground text-sm">
        {comment.author.name ?? comment.author.login}
      </span>
      <span className="text-muted-foreground text-xs">{formatDate(comment.createdAt)}</span>
    </div>
  );
}

function CommentThread({ comment, replies }: Readonly<{ comment: Comment; replies: Comment[] }>) {
  return (
    <article className="flex gap-3">
      <GradientAvatar
        seed={comment.author.id}
        label={comment.author.name ?? comment.author.login}
        size={34}
        className="rounded-[9px]"
      />
      <div className="flex flex-1 flex-col gap-1">
        <CommentMeta comment={comment} />
        <p className="text-muted-foreground text-sm leading-relaxed">{comment.body}</p>
        {replies.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3 border-border border-l-2 pl-3">
            {replies.map((reply) => (
              <div key={reply.id} className="flex gap-2.5">
                <GradientAvatar
                  seed={reply.author.id}
                  label={reply.author.name ?? reply.author.login}
                  size={30}
                  className="rounded-lg"
                />
                <div className="flex flex-1 flex-col gap-1">
                  <CommentMeta comment={reply} />
                  <p className="text-muted-foreground text-sm leading-relaxed">{reply.body}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
