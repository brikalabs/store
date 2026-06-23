import { Input } from "@brika/clay";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { Pill } from "@/components/clay/pill";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { SettingsCard } from "@/components/clay/settings-card";
import { AdminShell } from "@/components/layout/admin-shell";
import { type MemberScope, useScopes } from "@/hooks/use-scopes";

/** Normalize the claim input to a canonical `@name` scope (lowercase, single leading `@`). */
function normalizeScope(input: string): string {
  const lower = input.toLowerCase().replace(/^@+/, "");
  return `@${lower}`;
}

const route = getRouteApi("/dashboard/scopes");

export function ScopesPage() {
  const { user } = route.useRouteContext();
  const { scopes, reload } = useScopes();
  const [name, setName] = useState("@");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function claim(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const scope = normalizeScope(name);
    const res = await fetch(`/api/scopes/${encodeURIComponent(scope)}`, { method: "PUT" });
    setBusy(false);
    if (res.ok) {
      setName("@");
      reload();
    } else {
      const data: { error?: string } = await res.json();
      setError(data.error ?? "Could not claim scope");
    }
  }

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="Scopes">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
          Scopes
        </h1>
        <p className="max-w-[620px] text-muted-foreground text-sm">
          A scope (like <span className="font-mono text-foreground">@acme</span>) is your npm
          namespace and your account: it owns its members, profile, and published packages. Claiming
          one makes you its first admin.
        </p>
      </header>

      <SettingsCard className="block rounded-[20px]">
        <form onSubmit={claim} className="contents">
          <h2 className="mb-3.5 font-bold font-heading text-foreground text-lg tracking-tight">
            Claim a scope
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3.5 font-mono text-muted-foreground">
                @
              </span>
              <Input
                value={name}
                onChange={(event) => setName(normalizeScope(event.target.value))}
                placeholder="your-scope"
                aria-label="Scope"
                className="h-[46px] pl-7 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={busy || name.length < 3}
              className="inline-flex h-[46px] items-center gap-2 rounded-xl bg-brand px-5 font-bold text-brand-foreground text-sm hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-4" />
              {busy ? "Claiming…" : "Claim"}
            </button>
          </div>
          {error !== null && <p className="mt-3 text-danger text-sm">{error}</p>}
        </form>
      </SettingsCard>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold font-heading text-foreground text-lg tracking-tight">
          Your scopes
        </h2>
        <ScopeList scopes={scopes} />
      </section>
    </AdminShell>
  );
}

function ScopeList({ scopes }: Readonly<{ scopes: MemberScope[] | null }>) {
  if (scopes === null) {
    return <div className="h-20 animate-pulse rounded-[18px] bg-muted" />;
  }
  if (scopes.length === 0) {
    return (
      <p className="rounded-[18px] border border-border border-dashed bg-card/50 p-6 text-center text-muted-foreground text-sm">
        You don't own any scope yet. Claim one above to get started.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {scopes.map((s) => (
        <li key={s.scope}>
          <Link
            to="/dashboard/scopes/$scope"
            params={{ scope: s.scope }}
            className="flex items-center gap-[15px] rounded-[18px] border border-border bg-card p-[18px] shadow-sm transition-all hover:border-brand-border hover:shadow-md"
          >
            <GradientAvatar
              seed={s.scope}
              label={s.scope}
              imageUrl={`/api/scopes/${encodeURIComponent(s.scope)}/icon`}
              size={44}
              className="rounded-[13px]"
            />
            <div className="min-w-0 flex-1">
              <div className="font-mono font-semibold text-base text-foreground">{s.scope}</div>
              {s.displayName !== null && (
                <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
                  <ShieldCheck className="size-3.5 text-brand-ink" />
                  {s.displayName}
                </div>
              )}
            </div>
            <Pill tone="muted" className="px-3 font-bold capitalize">
              {s.role}
            </Pill>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
