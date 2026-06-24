import { Button, Card } from "@brika/clay";
import { getRouteApi } from "@tanstack/react-router";
import { LogOut, Plus } from "lucide-react";
import { TokenList } from "@/components/account/token-list";
import { SettingsCard } from "@/components/clay/settings-card";
import { AdminShell } from "@/components/layout/admin-shell";
import { CopyButton } from "@/components/plugin/copy-button";
import { useAccountTokens } from "@/hooks/use-account-tokens";
import { useT } from "@/i18n";

const route = getRouteApi("/dashboard/account/tokens");

export function TokensPage() {
  const t = useT();
  const { user } = route.useRouteContext();
  const { tokens, fresh, busy, create, revoke } = useAccountTokens();

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="API tokens">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
          {t("account:tokensTitle")}
        </h1>
        <p className="max-w-[640px] text-muted-foreground text-sm">
          {t("account:tokensIntroBefore")}{" "}
          <span className="font-mono text-foreground">brika publish</span>{" "}
          {t("account:tokensIntroAfter")}
        </p>
      </header>

      {fresh !== null && (
        <Card className="flex flex-col gap-2.5 rounded-[18px] border border-brand-border bg-brand-tint p-[22px] shadow-sm">
          <span className="font-semibold text-foreground text-sm">
            {t("account:freshTokenNotice")}
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-[10px] border border-border bg-card px-3 py-2 font-mono text-sm">
              {fresh}
            </code>
            <CopyButton value={fresh} label={t("account:copyToken")} />
          </div>
        </Card>
      )}

      <SettingsCard className="gap-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold font-heading text-foreground text-lg tracking-tight">
            {t("account:activeTokens")}
          </h2>
          <Button
            type="button"
            onClick={create}
            disabled={busy}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] bg-brand px-4 font-bold text-brand-foreground text-sm hover:brightness-105 disabled:opacity-60"
          >
            <Plus className="size-4" />
            {busy ? t("account:creating") : t("account:newToken")}
          </Button>
        </div>
        <TokenList tokens={tokens} onRevoke={revoke} />
      </SettingsCard>

      <SettingsCard className="flex-row items-center justify-between gap-0 px-[22px] py-[18px]">
        <div>
          <div className="font-semibold text-foreground text-sm">
            {t("account:signedInAs", { name: user.name ?? t("account:yourAccount") })}
          </div>
          <div className="text-muted-foreground text-xs">{t("account:endSession")}</div>
        </div>
        <Button
          asChild
          variant="outline"
          className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-input bg-card px-4 font-semibold text-foreground text-sm transition-colors hover:border-danger-border hover:text-danger"
        >
          <a href="/auth/logout">
            <LogOut className="size-4" />
            {t("account:signOut")}
          </a>
        </Button>
      </SettingsCard>
    </AdminShell>
  );
}
