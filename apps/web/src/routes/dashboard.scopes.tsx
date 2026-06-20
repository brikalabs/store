import { Button, Input } from "@brika/clay";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Layers, Plus, ShieldCheck } from "lucide-react";
import { type SyntheticEvent, useCallback, useEffect, useState } from "react";
import { AdminShell } from "../components/admin-shell";
import { requireUser } from "../lib/require-user";

export const Route = createFileRoute("/dashboard/scopes")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: ScopesPage,
});

interface MemberScope {
  scope: string;
  role: "admin" | "member";
  displayName: string | null;
}

function ScopesPage() {
  const { user } = Route.useRouteContext();
  const [scopes, setScopes] = useState<MemberScope[] | null>(null);
  const [name, setName] = useState("@");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/scopes");
    if (res.ok) {
      const data: { scopes: MemberScope[] } = await res.json();
      setScopes(data.scopes);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function claim(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/scopes/${encodeURIComponent(name)}`, { method: "PUT" });
    setBusy(false);
    if (res.ok) {
      setName("@");
      await load();
    } else {
      const data: { error?: string } = await res.json();
      setError(data.error ?? "Could not claim scope");
    }
  }

  return (
    <AdminShell login={user.login} activeLabel="Scopes">
      <header className="flex flex-col gap-1">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Scopes</h1>
        <p className="text-muted-foreground text-sm">
          A scope (like <span className="font-mono">@acme</span>) must exist before you can publish
          under it. Claiming one makes you its first admin.
        </p>
      </header>

      <form
        onSubmit={claim}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
      >
        <h2 className="font-bold font-heading text-lg tracking-tight">Claim a scope</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value.toLowerCase())}
            placeholder="@your-scope"
            aria-label="Scope name"
            className="font-mono"
          />
          <Button type="submit" disabled={busy || name.length < 3}>
            <Plus className="size-4" />
            {busy ? "Claiming…" : "Claim"}
          </Button>
        </div>
        {error !== null && <p className="text-destructive text-sm">{error}</p>}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold font-heading text-lg tracking-tight">Your scopes</h2>
        <ScopeList scopes={scopes} />
      </section>
    </AdminShell>
  );
}

function ScopeList({ scopes }: Readonly<{ scopes: MemberScope[] | null }>) {
  if (scopes === null) {
    return <div className="h-20 animate-pulse rounded-2xl bg-muted" />;
  }
  if (scopes.length === 0) {
    return (
      <p className="rounded-2xl border border-border border-dashed bg-card/50 p-6 text-center text-muted-foreground text-sm">
        You don't belong to any scope yet. Claim one above to get started.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {scopes.map((s) => (
        <li key={s.scope}>
          <Link
            to="/dashboard/scopes/$scope"
            params={{ scope: s.scope }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand/40"
          >
            <Layers className="size-5 text-brand-ink" />
            <div className="min-w-0 flex-1">
              <div className="font-mono font-semibold text-foreground">{s.scope}</div>
              {s.displayName !== null && (
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <ShieldCheck className="size-3.5" />
                  {s.displayName}
                </div>
              )}
            </div>
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 font-semibold text-muted-foreground text-xs capitalize">
              {s.role}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
