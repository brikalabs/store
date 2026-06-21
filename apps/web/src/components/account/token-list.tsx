import { KeyRound, Trash2 } from "lucide-react";

export interface Token {
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number | null;
}

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
  if (tokens === null) {
    return <div className="h-16 animate-pulse rounded-xl bg-muted" />;
  }
  if (tokens.length === 0) {
    return <p className="text-muted-foreground text-sm">No tokens yet.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {tokens.map((t) => (
        <li key={t.tokenHash} className="flex items-center gap-3 py-3">
          <KeyRound className="size-4 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-foreground text-sm">token …{t.tokenHash.slice(-8)}</div>
            <div className="text-muted-foreground text-xs">
              Created {fmt(t.createdAt)} · Expires {fmt(t.expiresAt)} · Last used{" "}
              {fmt(t.lastUsedAt)}
            </div>
          </div>
          <button
            type="button"
            aria-label="Revoke token"
            onClick={() => onRevoke(t.tokenHash)}
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
