import { Button, Input } from "@brika/clay";
import { Trash2, UserPlus } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { readError, type ScopeCardProps, scopePath } from "@/lib/scope-api";

export interface Member {
  userId: string;
  /** The account's display name + avatar, resolved server-side (membership stores only the id). */
  displayName: string | null;
  avatarUrl: string | null;
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
  // Re-roling an existing member keys off their account id (already a member); the
  // email-based invite (AddMember below) is only for adding someone new.
  async function setRole(member: Member, role: "admin" | "member") {
    const res = await fetch(scopePath(scope, `/members/${encodeURIComponent(member.userId)}`), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) await onReload();
    else onError(await readError(res));
  }

  async function remove(member: Member) {
    const res = await fetch(scopePath(scope, `/members/${encodeURIComponent(member.userId)}`), {
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
          {members.map((m) => {
            const label = m.displayName ?? m.userId;
            return (
              <li key={m.userId} className="flex items-center gap-3 py-3">
                <GradientAvatar seed={m.userId} label={label} imageUrl={m.avatarUrl} size={28} />
                <span className="flex-1 truncate text-sm">{label}</span>
                {isAdmin ? (
                  <>
                    <select
                      aria-label={`Role for ${label}`}
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
                      aria-label={`Remove ${label}`}
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
            );
          })}
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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const res = await fetch(scopePath(scope, "/members"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    setBusy(false);
    if (res.ok) {
      setEmail("");
      await onAdded();
    } else {
      onError(await readError(res));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-border border-t pt-4 sm:flex-row">
      <Input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="member@email.com"
        aria-label="Email of the account to invite"
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
      <Button type="submit" disabled={busy || email.trim().length === 0}>
        <UserPlus className="size-4" />
        {busy ? "Adding…" : "Add member"}
      </Button>
    </form>
  );
}
