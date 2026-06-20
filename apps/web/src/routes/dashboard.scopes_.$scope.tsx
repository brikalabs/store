import { Button, Input } from "@brika/clay";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { type SyntheticEvent, useCallback, useEffect, useState } from "react";
import { AdminShell } from "../components/admin-shell";
import { GithubIcon } from "../components/clay/icons";
import { requireUser } from "../lib/require-user";

export const Route = createFileRoute("/dashboard/scopes_/$scope")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: ScopeDetailPage,
});

interface Member {
  provider: string;
  id: string;
  role: "admin" | "member";
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "Request failed";
}

const ROLE_SELECT =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 font-medium text-sm";

function ScopeDetailPage() {
  const { user } = Route.useRouteContext();
  const { scope } = Route.useParams();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/scopes/${encodeURIComponent(scope)}/members`);
    if (res.ok) {
      const data: { members: Member[] } = await res.json();
      setMembers(data.members);
      setError(null);
    } else {
      setError(await readError(res));
    }
  }, [scope]);
  useEffect(() => {
    void load();
  }, [load]);

  const myRole = members?.find((m) => m.provider === "github" && m.id === user.login)?.role;
  const isAdmin = myRole === "admin";

  async function setRole(member: Member, role: "admin" | "member") {
    const res = await fetch(`/api/scopes/${encodeURIComponent(scope)}/members`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: member.id, role }),
    });
    if (res.ok) await load();
    else setError(await readError(res));
  }

  async function remove(member: Member) {
    const res = await fetch(
      `/api/scopes/${encodeURIComponent(scope)}/members/${encodeURIComponent(member.id)}`,
      { method: "DELETE" },
    );
    if (res.ok) await load();
    else setError(await readError(res));
  }

  return (
    <AdminShell login={user.login} activeLabel="Scopes">
      <div>
        <Link
          to="/dashboard/scopes"
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All scopes
        </Link>
        <h1 className="mt-2 font-mono font-bold text-2xl tracking-tight">{scope}</h1>
      </div>

      {error !== null && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          {error}
        </p>
      )}

      {isAdmin && <DisplayNameCard scope={scope} onError={setError} />}

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-bold font-heading text-lg tracking-tight">Members</h2>
        {members === null ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted" />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {members.map((m) => (
              <li key={`${m.provider}:${m.id}`} className="flex items-center gap-3 py-3">
                <GithubIcon className="size-4 text-muted-foreground" />
                <span className="flex-1 font-mono text-sm">{m.id}</span>
                {isAdmin ? (
                  <>
                    <select
                      aria-label={`Role for ${m.id}`}
                      value={m.role}
                      onChange={(event) =>
                        setRole(m, event.target.value === "admin" ? "admin" : "member")
                      }
                      className={ROLE_SELECT}
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove ${m.id}`}
                      onClick={() => remove(m)}
                      className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                ) : (
                  <span className="rounded-full border border-border bg-muted px-2.5 py-1 font-semibold text-muted-foreground text-xs capitalize">
                    {m.role}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {isAdmin && <AddMember scope={scope} onAdded={load} onError={setError} />}
      </section>
    </AdminShell>
  );
}

function AddMember({
  scope,
  onAdded,
  onError,
}: Readonly<{ scope: string; onAdded: () => Promise<void>; onError: (m: string) => void }>) {
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/scopes/${encodeURIComponent(scope)}/members`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: login.trim(), role }),
    });
    setBusy(false);
    if (res.ok) {
      setLogin("");
      await onAdded();
    } else {
      onError(await readError(res));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-border border-t pt-4 sm:flex-row">
      <Input
        value={login}
        onChange={(event) => setLogin(event.target.value)}
        placeholder="GitHub login"
        aria-label="GitHub login to add"
        className="font-mono"
      />
      <select
        aria-label="Role for the new member"
        value={role}
        onChange={(event) => setRole(event.target.value === "admin" ? "admin" : "member")}
        className={ROLE_SELECT}
      >
        <option value="member">member</option>
        <option value="admin">admin</option>
      </select>
      <Button type="submit" disabled={busy || login.trim().length === 0}>
        <UserPlus className="size-4" />
        {busy ? "Adding…" : "Add member"}
      </Button>
    </form>
  );
}

function DisplayNameCard({
  scope,
  onError,
}: Readonly<{ scope: string; onError: (m: string) => void }>) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    const trimmed = value.trim();
    const res = await fetch(`/api/scopes/${encodeURIComponent(scope)}/display-name`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: trimmed.length === 0 ? null : trimmed }),
    });
    setBusy(false);
    if (res.ok) setSaved(true);
    else onError(await readError(res));
  }

  let saveLabel = "Save";
  if (busy) saveLabel = "Saving…";
  else if (saved) saveLabel = "Saved";

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-brand-ink" />
        <h2 className="font-bold font-heading text-lg tracking-tight">Verified publisher name</h2>
      </div>
      <p className="text-muted-foreground text-sm">
        The trusted name shown on every package in this scope, overriding the manifest author. Leave
        blank to clear it.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Acme Inc"
          aria-label="Verified publisher display name"
        />
        <Button type="submit" disabled={busy}>
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}
