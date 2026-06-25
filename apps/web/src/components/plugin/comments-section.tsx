import { Textarea } from "@brika/clay";
import type { Comment } from "@brika/registry-contract";
import { ChevronUp } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { SignInToParticipate, SubmitRow } from "@/components/plugin/participation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePluginComments } from "@/hooks/use-plugin-comments";
import { useDateFormat, useT } from "@/i18n";

/** The comment "grade": an upvote toggle showing the running tally. */
function UpvoteButton({
  comment,
  disabled,
  onVote,
}: Readonly<{ comment: Comment; disabled: boolean; onVote: (id: string) => void }>) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => onVote(comment.id)}
      disabled={disabled}
      aria-pressed={comment.viewerUpvoted}
      aria-label={t("plugin:upvoteComment")}
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
  const t = useT();
  const { user } = useCurrentUser();
  const { comments, submitting, error, vote, submit } = usePluginComments(pluginName, fallback);
  const [body, setBody] = useState("");

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim().length === 0) return;
    void submit(body.trim()).then((ok) => {
      if (ok) setBody("");
    });
  }

  return (
    <section id="discussion" className="flex flex-col gap-4 scroll-mt-20">
      <h2 className="font-bold font-heading text-xl tracking-tight">{t("plugin:discussion")}</h2>

      {user ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <Textarea
            placeholder={t("plugin:commentPlaceholder")}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
          />
          <SubmitRow
            error={error}
            submitting={submitting}
            busyLabel={t("plugin:commentPosting")}
            submitLabel={t("plugin:commentPost")}
          />
        </form>
      ) : (
        <SignInToParticipate>{t("plugin:commentSignIn")}</SignInToParticipate>
      )}

      <div className="flex flex-col gap-5">
        {comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("plugin:noComments")}</p>
        ) : (
          comments
            .filter((comment) => !comment.parentId)
            .map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                replies={comments.filter((reply) => reply.parentId === comment.id)}
                viewerId={user?.id ?? null}
                onVote={vote}
              />
            ))
        )}
      </div>
    </section>
  );
}

function CommentMeta({ comment }: Readonly<{ comment: Comment }>) {
  const date = useDateFormat();
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-foreground text-sm">{comment.author.displayName}</span>
      <span className="text-muted-foreground text-xs">{date(comment.createdAt)}</span>
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
        label={comment.author.displayName}
        imageUrl={comment.author.avatarUrl}
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
                  label={reply.author.displayName}
                  imageUrl={reply.author.avatarUrl}
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
