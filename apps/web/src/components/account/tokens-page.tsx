import { Button, Card } from "@brika/clay";
import { getRouteApi } from "@tanstack/react-router";
import { LogOut, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type Token, TokenList } from "@/components/account/token-list";
import { SettingsCard } from "@/components/clay/settings-card";
import { AdminShell } from "@/components/layout/admin-shell";
import { CopyButton } from "@/components/plugin/copy-button";

const route = getRouteApi("/dashboard/account/tokens");

export function TokensPage() {
  const { user } = route.useRouteContext();
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/account/tokens");
    if (res.ok) {
      const data: { tokens: Token[] } = await res.json();
      setTokens(data.tokens);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    const res = await fetch("/api/account/tokens", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const data: { token: string } = await res.json();
      setFresh(data.token);
      await load();
    }
  }

  async function revoke(hash: string) {
    const res = await fetch(`/api/account/tokens/${encodeURIComponent(hash)}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  }

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="API tokens">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
          API tokens
        </h1>
        <p className="max-w-[640px] text-muted-foreground text-sm">
          Tokens authenticate <span className="font-mono text-foreground">brika publish</span> from
          your machine. A token is shown once at creation; afterward it is identified only by its
          fingerprint.
        </p>
      </header>

      {fresh !== null && (
        <Card className="flex flex-col gap-2.5 rounded-[18px] border border-brand-border bg-brand-tint p-[22px] shadow-sm">
          <span className="font-semibold text-foreground text-sm">
            Your new token (copy it now, it won't be shown again):
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-[10px] border border-border bg-card px-3 py-2 font-mono text-sm">
              {fresh}
            </code>
            <CopyButton value={fresh} label="Copy token" />
          </div>
        </Card>
      )}

      <SettingsCard className="gap-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold font-heading text-foreground text-lg tracking-tight">
            Active tokens
          </h2>
          <Button
            type="button"
            onClick={create}
            disabled={busy}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] bg-brand px-4 font-bold text-brand-foreground text-sm hover:brightness-105 disabled:opacity-60"
          >
            <Plus className="size-4" />
            {busy ? "Creating…" : "New token"}
          </Button>
        </div>
        <TokenList tokens={tokens} onRevoke={revoke} />
      </SettingsCard>

      <SettingsCard className="flex-row items-center justify-between gap-0 px-[22px] py-[18px]">
        <div>
          <div className="font-semibold text-foreground text-sm">
            Signed in as {user.name ?? "your account"}
          </div>
          <div className="text-muted-foreground text-xs">End your session on this device.</div>
        </div>
        <Button
          asChild
          variant="outline"
          className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-input bg-card px-4 font-semibold text-foreground text-sm transition-colors hover:border-danger-border hover:text-danger"
        >
          <a href="/auth/logout">
            <LogOut className="size-4" />
            Sign out
          </a>
        </Button>
      </SettingsCard>
    </AdminShell>
  );
}
