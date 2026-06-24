import { Button, EmptyState, EmptyStateDescription, EmptyStateTitle } from "@brika/clay";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import type { Token } from "@/hooks/use-account-tokens";

/** Epoch-seconds timestamp to a short local date, or a placeholder. */
function fmt(seconds: number | null): string {
  if (seconds === null) return "never";
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TokenList({
  tokens,
  onRevoke,
}: Readonly<{ tokens: Token[] | null; onRevoke: (hash: string) => void }>) {
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  if (tokens === null) {
    return <div className="h-[60px] animate-pulse rounded-xl bg-muted" />;
  }
  if (tokens.length === 0) {
    return (
      <EmptyState>
        <EmptyStateTitle>No tokens yet</EmptyStateTitle>
        <EmptyStateDescription>
          Create a token to authenticate publishing from your machine.
        </EmptyStateDescription>
      </EmptyState>
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {tokens.map((t, i) => {
          const active = i === 0;
          return (
            <li
              key={t.tokenHash}
              className="flex items-center gap-3.5 rounded-xl border border-border bg-muted px-[15px] py-[13px]"
            >
              <span
                className={`flex size-[34px] flex-shrink-0 items-center justify-center rounded-[9px] ${
                  active ? "bg-brand-tint text-brand-ink" : "bg-accent text-muted-foreground"
                }`}
              >
                <KeyRound className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground text-sm">
                  token …{t.tokenHash.slice(-8)}
                </div>
                <div className="truncate font-mono text-muted-foreground text-xs">
                  Created {fmt(t.createdAt)} · Expires {fmt(t.expiresAt)} · Last used{" "}
                  {fmt(t.lastUsedAt)}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingRevoke(t.tokenHash)}
                className="inline-flex h-[34px] items-center rounded-[9px] border border-input bg-card px-3.5 font-semibold text-xs hover:border-danger-border hover:text-danger"
              >
                Revoke
              </Button>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null);
        }}
        title="Revoke token"
        description="This token will stop working immediately and cannot be restored. Any machine using it will need a new token."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          if (pendingRevoke !== null) onRevoke(pendingRevoke);
          setPendingRevoke(null);
        }}
      />
    </>
  );
}
