import { Button } from "@brika/clay";
import { getRouteApi } from "@tanstack/react-router";
import { LogOut, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type Token, TokenList } from "@/components/account/token-list";
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
      <header className="flex flex-col gap-1">
        <h1 className="font-bold font-heading text-2xl tracking-tight">API tokens</h1>
        <p className="text-muted-foreground text-sm">
          Tokens authenticate <span className="font-mono">brika publish</span> from your machine. A
          token is shown once at creation; afterward it is identified only by its fingerprint.
        </p>
      </header>

      {fresh !== null && (
        <div className="flex flex-col gap-2 rounded-2xl border border-brand/40 bg-brand/5 p-5">
          <span className="font-semibold text-foreground text-sm">
            Your new token (copy it now, it won't be shown again):
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm">
              {fresh}
            </code>
            <CopyButton value={fresh} label="Copy token" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold font-heading text-lg tracking-tight">Active tokens</h2>
          <Button type="button" onClick={create} disabled={busy}>
            <Plus className="size-4" />
            {busy ? "Creating…" : "New token"}
          </Button>
        </div>
        <TokenList tokens={tokens} onRevoke={revoke} />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-6">
        <div>
          <div className="font-semibold text-foreground text-sm">
            Signed in as {user.name ?? "your account"}
          </div>
          <div className="text-muted-foreground text-xs">End your session on this device.</div>
        </div>
        <a
          href="/auth/logout"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 font-medium text-sm text-foreground transition-colors hover:bg-muted"
        >
          <LogOut className="size-4" />
          Sign out
        </a>
      </div>
    </AdminShell>
  );
}
