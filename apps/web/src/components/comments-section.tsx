import { Button, Textarea } from "@brika/clay";
import { Comment } from "@brika/registry-contract";
import { ChevronUp } from "lucide-react";
import { type SyntheticEvent, useEffect, useState } from "react";
import { z } from "zod";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDate } from "@/lib/format";
import { GradientAvatar } from "./clay/plugin-icon";

/** The comment "grade": an upvote toggle showing the running tally. */
function UpvoteButton({
  comment,
  disabled,
  onVote,
}: Readonly<{ comment: Comment; disabled: boolean; onVote: (id: string) => void }>) {
  return (
    <button
      type="button"
      onClick={() => onVote(comment.id)}
      disabled={disabled}
      aria-pressed={comment.viewerUpvoted}
      aria-label="Upvote comment"
      className={
        comment.viewerUpvoted
          ? "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-ember-600 text-xs"
          : "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground text-xs hover:text-foreground disabled:hover:text-muted-foreground"
      }
    >
      <ChevronUp className={comment.viewerUpvoted ? "size-3.5 text-ember-600" : "size-3.5"} />
      {comment.upvotes}
    </button>
  );
}

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

  async function handleVote(commentId: string) {
    const res = await fetch(`${endpoint}/${commentId}/vote`, { method: "POST" });
    if (res.status === 401) {
      setError("Please sign in to upvote comments.");
      return;
    }
    const parsed = z.array(Comment).safeParse(await res.json());
    if (parsed.success) setComments(parsed.data);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
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
                viewerId={user?.id ?? null}
                onVote={handleVote}
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

function CommentThread({
  comment,
  replies,
  viewerId,
  onVote,
}: Readonly<{
  comment: Comment;
  replies: Comment[];
  viewerId: string | null;
  onVote: (id: string) => void;
}>) {
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
        {comment.deleted ? null : (
          <div className="mt-1">
            <UpvoteButton
              comment={comment}
              disabled={viewerId === null || comment.author.id === viewerId}
              onVote={onVote}
            />
          </div>
        )}
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
                  {reply.deleted ? null : (
                    <div className="mt-1">
                      <UpvoteButton
                        comment={reply}
                        disabled={viewerId === null || reply.author.id === viewerId}
                        onVote={onVote}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
