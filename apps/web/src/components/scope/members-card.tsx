import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@brika/clay";
import { UserPlus, X } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { Pill } from "@/components/clay/pill";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { SettingsCard } from "@/components/clay/settings-card";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { readError, type ScopeCardProps, scopePath } from "@/lib/scope-api";

export interface Member {
  userId: string;
  /** The account's display name + avatar, resolved server-side (membership stores only the id). */
  displayName: string | null;
  avatarUrl: string | null;
  role: "admin" | "member";
}

const ROLE_SELECT =
  "h-[34px] rounded-[10px] border border-input bg-muted px-3 font-semibold text-[12.5px] text-foreground";

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
    <SettingsCard className="gap-1">
      <h2 className="font-bold text-base text-foreground">Members</h2>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
        Members are identified by their Brika user ID. Emails are never shown or stored on the
        scope.
      </p>
      {members === null ? (
        <div className="mt-3 h-16 animate-pulse rounded-[11px] bg-muted" />
      ) : (
        <ul className="mt-2 flex flex-col">
          {members.map((m) => {
            const label = m.displayName ?? m.userId;
            return (
              <li key={m.userId} className="flex items-center gap-3 border-border border-b py-3">
                <GradientAvatar seed={m.userId} label={label} imageUrl={m.avatarUrl} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-[13.5px] text-foreground">
                    {label}
                  </div>
                  <div className="truncate font-mono text-muted-foreground text-xs">{m.userId}</div>
                </div>
                {isAdmin ? (
                  <>
                    <Select
                      value={m.role}
                      onValueChange={(value) => setRole(m, value === "admin" ? "admin" : "member")}
                    >
                      <SelectTrigger aria-label={`Role for ${label}`} className={ROLE_SELECT}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="member">member</SelectItem>
                      </SelectContent>
                    </Select>
                    <RemoveMember member={m} label={label} onRemove={() => remove(m)} />
                  </>
                ) : (
                  <Pill tone="muted" className="capitalize">
                    {m.role}
                  </Pill>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {isAdmin && <AddMember scope={scope} onAdded={onReload} onError={onError} />}
    </SettingsCard>
  );
}

/** Remove button + a destructive confirm dialog (keeps the parent's `remove(member)` handler). */
function RemoveMember({
  member,
  label,
  onRemove,
}: Readonly<{ member: Member; label: string; onRemove: () => void }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Remove ${label}`}
        onClick={() => setOpen(true)}
        className="flex size-[34px] items-center justify-center rounded-[10px] border border-input bg-card text-muted-foreground hover:border-danger-border hover:bg-card hover:text-danger"
      >
        <X className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove member"
        description={
          <>
            Remove <span className="font-mono">{member.userId}</span> from this scope? They will
            lose access immediately.
          </>
        }
        confirmLabel="Remove member"
        destructive
        onConfirm={() => {
          setOpen(false);
          onRemove();
        }}
      />
    </>
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
    <div className="mt-4 flex flex-col gap-2.5">
      <p className="text-muted-foreground text-xs leading-relaxed">
        Add someone by their account. They will lose access if you remove them; we never list or
        search users by email.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="member@email.com"
          aria-label="Email of the account to invite"
          className="flex-1 rounded-[11px] border-input bg-muted"
        />
        <Select
          value={role}
          onValueChange={(value) => setRole(value === "admin" ? "admin" : "member")}
        >
          <SelectTrigger
            aria-label="Role for the new member"
            className="h-[42px] rounded-[11px] border border-input bg-muted px-3 font-semibold text-foreground text-sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">member</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="submit"
          disabled={busy || email.trim().length === 0}
          className="h-[42px] rounded-[11px] bg-brand px-4 font-bold text-brand-foreground hover:bg-brand hover:brightness-105"
        >
          <UserPlus className="size-4" />
          {busy ? "Adding…" : "Add member"}
        </Button>
      </form>
    </div>
  );
}
