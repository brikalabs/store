import { Button, Input } from "@brika/clay";
import { Trash2, UserPlus } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { GithubIcon } from "@/components/clay/icons";
import { readError, type ScopeCardProps, scopePath } from "@/lib/scope-api";

export interface Member {
  provider: string;
  id: string;
  role: "admin" | "member";
}

const ROLE_SELECT =
  "rounded-lg border border-border bg-background px-2.5 py-1.5 font-medium text-sm";

interface MembersCardProps extends ScopeCardProps {
  readonly members: Member[] | null;
  readonly isAdmin: boolean;
  /** Re-fetch the member list after a mutation (owned by the parent for the admin check). */
  readonly onReload: () => Promise<void>;
}

/** The scope's members + roles (admins manage; the last-admin invariant is enforced server-side). */
export function MembersCard({
  scope,
  members,
  isAdmin,
  onReload,
  onError,
}: Readonly<MembersCardProps>) {
  async function setRole(member: Member, role: "admin" | "member") {
    const res = await fetch(scopePath(scope, "/members"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: member.id, role }),
    });
    if (res.ok) await onReload();
    else onError(await readError(res));
  }

  async function remove(member: Member) {
    const res = await fetch(scopePath(scope, `/members/${encodeURIComponent(member.id)}`), {
      method: "DELETE",
    });
    if (res.ok) await onReload();
    else onError(await readError(res));
  }

  return (
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
      {isAdmin && <AddMember scope={scope} onAdded={onReload} onError={onError} />}
    </section>
  );
}

function AddMember({
  scope,
  onAdded,
  onError,
}: Readonly<ScopeCardProps & { onAdded: () => Promise<void> }>) {
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const res = await fetch(scopePath(scope, "/members"), {
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
