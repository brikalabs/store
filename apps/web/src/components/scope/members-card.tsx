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
import { type Member, useScopeMembers } from "@/hooks/use-scope-members";
import { useT } from "@/i18n";
import type { ScopeCardProps } from "@/lib/scope-api";

export type { Member } from "@/hooks/use-scope-members";

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
  const t = useT();
  const { busy, setRole, remove, add } = useScopeMembers(scope, onReload, onError);

  return (
    <SettingsCard className="gap-1">
      <h2 className="font-bold text-base text-foreground">{t("scope:membersTitle")}</h2>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
        {t("scope:membersDescription")}
      </p>
      {members === null ? (
        <div className="mt-3 h-16 animate-pulse rounded-[11px] bg-muted" />
      ) : (
        <ul className="mt-2 flex flex-col">
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isAdmin={isAdmin}
              onRole={(role) => setRole(m, role)}
              onRemove={() => remove(m)}
            />
          ))}
        </ul>
      )}
      {isAdmin && <AddMember busy={busy} onAdd={add} />}
    </SettingsCard>
  );
}

/** One member row: avatar + identity, then an admin's role select + remove, or a plain role pill. */
function MemberRow({
  member,
  isAdmin,
  onRole,
  onRemove,
}: Readonly<{
  member: Member;
  isAdmin: boolean;
  onRole: (role: "admin" | "member") => void;
  onRemove: () => void;
}>) {
  const t = useT();
  const label = member.displayName ?? member.userId;
  return (
    <li className="flex items-center gap-3 border-border border-b py-3">
      <GradientAvatar seed={member.userId} label={label} imageUrl={member.avatarUrl} size={34} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-[13.5px] text-foreground">{label}</div>
        <div className="truncate font-mono text-muted-foreground text-xs">{member.userId}</div>
      </div>
      {isAdmin ? (
        <>
          <Select
            value={member.role}
            onValueChange={(value) => onRole(value === "admin" ? "admin" : "member")}
          >
            <SelectTrigger
              aria-label={t("scope:roleForAriaLabel", { name: label })}
              className={ROLE_SELECT}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="member">member</SelectItem>
            </SelectContent>
          </Select>
          <RemoveMember member={member} label={label} onRemove={onRemove} />
        </>
      ) : (
        <Pill tone="muted" className="capitalize">
          {member.role}
        </Pill>
      )}
    </li>
  );
}

/** Remove button + a destructive confirm dialog (keeps the parent's `remove(member)` handler). */
function RemoveMember({
  member,
  label,
  onRemove,
}: Readonly<{ member: Member; label: string; onRemove: () => void }>) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={t("scope:removeMemberAriaLabel", { name: label })}
        onClick={() => setOpen(true)}
        className="flex size-[34px] items-center justify-center rounded-[10px] border border-input bg-card text-muted-foreground hover:border-danger-border hover:bg-card hover:text-danger"
      >
        <X className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("scope:removeMemberDialogTitle")}
        description={
          <>
            {t("scope:removeMemberDialogPrefix")}
            <span className="font-mono">{member.userId}</span>
            {t("scope:removeMemberDialogSuffix")}
          </>
        }
        confirmLabel={t("scope:removeMemberConfirm")}
        destructive
        onConfirm={() => {
          setOpen(false);
          onRemove();
        }}
      />
    </>
  );
}

/** Invite-by-email form: pick a role, submit, and clear the email when the add succeeds. */
function AddMember({
  busy,
  onAdd,
}: Readonly<{
  busy: boolean;
  onAdd: (email: string, role: "admin" | "member") => Promise<boolean>;
}>) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void onAdd(email, role).then((ok) => {
      if (ok) setEmail("");
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-2.5">
      <p className="text-muted-foreground text-xs leading-relaxed">
        {t("scope:addMemberDescription")}
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("scope:addMemberEmailPlaceholder")}
          aria-label={t("scope:addMemberEmailAriaLabel")}
          className="flex-1 rounded-[11px] border-input bg-muted"
        />
        <Select
          value={role}
          onValueChange={(value) => setRole(value === "admin" ? "admin" : "member")}
        >
          <SelectTrigger
            aria-label={t("scope:addMemberRoleAriaLabel")}
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
          {busy ? t("scope:adding") : t("scope:addMember")}
        </Button>
      </form>
    </div>
  );
}
