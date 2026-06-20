import { Button, Input } from "@brika/clay";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { type SyntheticEvent, useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/dashboard/orgs")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: OrgsPage,
});

interface MemberOrg {
  slug: string;
  role: "admin" | "member";
  displayName: string | null;
}

function OrgsPage() {
  const { user } = Route.useRouteContext();
  const [orgs, setOrgs] = useState<MemberOrg[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/orgs");
    if (res.ok) {
      const data: { orgs: MemberOrg[] } = await res.json();
      setOrgs(data.orgs);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function claim(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orgs/${encodeURIComponent(name)}`, { method: "PUT" });
    setBusy(false);
    if (res.ok) {
      setName("");
      await load();
    } else {
      const data: { error?: string } = await res.json();
      setError(data.error ?? "Could not claim organisation");
    }
  }

  return (
    <AdminShell login={user.login} activeLabel="Organisations">
      <header className="flex flex-col gap-1">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Organisations</h1>
        <p className="text-muted-foreground text-sm">
          An organisation (like <span className="font-mono">acme</span>) owns one or more npm scopes
          and its member list. Claiming one makes you its first admin.
        </p>
      </header>

      <form
        onSubmit={claim}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
      >
        <h2 className="font-bold font-heading text-lg tracking-tight">Claim an organisation</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value.toLowerCase())}
            placeholder="your-org"
            aria-label="Organisation slug"
            className="font-mono"
          />
          <Button type="submit" disabled={busy || name.length < 2}>
            <Plus className="size-4" />
            {busy ? "Claiming…" : "Claim"}
          </Button>
        </div>
        {error !== null && <p className="text-destructive text-sm">{error}</p>}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold font-heading text-lg tracking-tight">Your organisations</h2>
        <OrgList orgs={orgs} />
      </section>
    </AdminShell>
  );
}

function OrgList({ orgs }: Readonly<{ orgs: MemberOrg[] | null }>) {
  if (orgs === null) {
    return <div className="h-20 animate-pulse rounded-2xl bg-muted" />;
  }
  if (orgs.length === 0) {
    return (
      <p className="rounded-2xl border border-border border-dashed bg-card/50 p-6 text-center text-muted-foreground text-sm">
        You don't belong to any organisation yet. Claim one above to get started.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {orgs.map((o) => (
        <li key={o.slug}>
          <Link
            to="/dashboard/orgs/$org"
            params={{ org: o.slug }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand/40"
          >
            <Building2 className="size-5 text-brand-ink" />
            <div className="min-w-0 flex-1">
              <div className="font-mono font-semibold text-foreground">{o.slug}</div>
              {o.displayName !== null && (
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <ShieldCheck className="size-3.5" />
                  {o.displayName}
                </div>
              )}
            </div>
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 font-semibold text-muted-foreground text-xs capitalize">
              {o.role}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
