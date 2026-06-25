import { Button, EmptyState, EmptyStateDescription, EmptyStateTitle } from "@brika/clay";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import type { Token } from "@/hooks/use-account-tokens";
import { useLocale, useT } from "@/i18n";

/** Epoch-seconds timestamp to a short local date, or `null` when absent. */
function fmt(seconds: number | null, locale: string): string | null {
  if (seconds === null) return null;
  return new Date(seconds * 1000).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TokenList({
  tokens,
  onRevoke,
}: Readonly<{ tokens: Token[] | null; onRevoke: (hash: string) => void }>) {
  const t = useT();
  const locale = useLocale();
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);
  const date = (seconds: number | null) => fmt(seconds, locale) ?? t("account:tokenNever");

  if (tokens === null) {
    return <div className="h-[60px] animate-pulse rounded-xl bg-muted" />;
  }
  if (tokens.length === 0) {
    return (
      <EmptyState>
        <EmptyStateTitle>{t("account:tokensEmptyTitle")}</EmptyStateTitle>
        <EmptyStateDescription>{t("account:tokensEmptyDescription")}</EmptyStateDescription>
      </EmptyState>
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {tokens.map((token, i) => {
          const active = i === 0;
          return (
            <li
              key={token.tokenHash}
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
                  {t("account:tokenName", { fingerprint: token.tokenHash.slice(-8) })}
                </div>
                <div className="truncate font-mono text-muted-foreground text-xs">
                  {t("account:tokenMeta", {
                    created: date(token.createdAt),
                    expires: date(token.expiresAt),
                    lastUsed: date(token.lastUsedAt),
                  })}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingRevoke(token.tokenHash)}
                className="inline-flex h-[34px] items-center rounded-[9px] border border-input bg-card px-3.5 font-semibold text-xs hover:border-danger-border hover:text-danger"
              >
                {t("account:revoke")}
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
        title={t("account:revokeTitle")}
        description={t("account:revokeDescription")}
        confirmLabel={t("account:revoke")}
        destructive
        onConfirm={() => {
          if (pendingRevoke !== null) onRevoke(pendingRevoke);
          setPendingRevoke(null);
        }}
      />
    </>
  );
}
