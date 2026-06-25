import { Button } from "@brika/clay";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut, Shield } from "lucide-react";
import { useState } from "react";
import { Pill } from "@/components/clay/pill";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { AdminShell } from "@/components/layout/admin-shell";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { DangerRow, DangerZone } from "@/components/layout/danger-zone";
import { ErrorBanner } from "@/components/layout/error-banner";
import { DisplayNameCard } from "@/components/scope/display-name-card";
import { DomainsCard } from "@/components/scope/domains-card";
import { LogoCard } from "@/components/scope/logo-card";
import { MembersCard } from "@/components/scope/members-card";
import { ProfileCard } from "@/components/scope/profile-card";
import { TrustedPublishersCard } from "@/components/scope/trusted-publishers-card";
import { type Member, useScopeMemberList } from "@/hooks/use-scope-members";
import { useT } from "@/i18n";

const route = getRouteApi("/dashboard/scopes_/$scope");

/**
 * Scope management shell. Owns the one member list (via `useScopeMemberList`), whose result decides
 * whether the user is an admin (gating the editor cards), and delegates each concern to a card in
 * `components/scope/*`.
 */
export function ScopeDetailPage() {
  const t = useT();
  const { user } = route.useRouteContext();
  const { scope } = route.useParams();
  const info = route.useLoaderData();
  const [error, setError] = useState<string | null>(null);
  const { members, reload, leave } = useScopeMemberList(scope, setError);

  const isAdmin = members?.find((m) => m.userId === user.id)?.role === "admin";

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="Scopes">
      <div>
        <Button asChild variant="link" size="sm" className="h-auto w-fit gap-1.5 p-0">
          <Link
            to="/dashboard/scopes"
            className="inline-flex items-center text-muted-foreground text-sm hover:text-brand-ink hover:no-underline"
          >
            <ArrowLeft className="size-4" />
            {t("scope:backToAll")}
          </Link>
        </Button>
        <div className="mt-2.5 flex items-center gap-3.5">
          <GradientAvatar
            seed={scope}
            label={scope}
            imageUrl={`/api/scopes/${encodeURIComponent(scope)}/icon`}
            size={46}
            className="rounded-[13px] border border-border"
          />
          <h1 className="font-mono font-semibold text-[28px] text-foreground tracking-[-0.02em]">
            {scope}
          </h1>
          {isAdmin && (
            <Pill tone="brand" className="px-3 font-bold">
              {t("scope:adminBadge")}
            </Pill>
          )}
        </div>
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      {isAdmin && (
        <DisplayNameCard scope={scope} current={info?.displayName ?? null} onError={setError} />
      )}
      {isAdmin && <LogoCard scope={scope} onError={setError} />}
      {isAdmin && <ProfileCard scope={scope} onError={setError} />}
      {isAdmin && <DomainsCard scope={scope} onError={setError} />}
      <TrustedPublishersCard scope={scope} isAdmin={isAdmin} onError={setError} />
      <MembersCard
        scope={scope}
        members={members}
        isAdmin={isAdmin}
        onReload={reload}
        onError={setError}
      />
      {isAdmin && (
        <ScopeDangerZone scope={scope} userId={user.id} members={members} onLeave={leave} />
      )}
    </AdminShell>
  );
}

/**
 * Admin-only danger zone with a single "Leave scope" action: removes the signed-in user's own
 * membership via `useScopeMemberList`'s `leave`, then sends them back to the scopes list. Disabled
 * when they are the only admin (the last-admin invariant), matching the server guard so the user
 * gets the amber hint instead of a failed request.
 */
function ScopeDangerZone({
  scope,
  userId,
  members,
  onLeave,
}: Readonly<{
  scope: string;
  userId: string;
  members: Member[] | null;
  onLeave: (userId: string) => Promise<boolean>;
}>) {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const onlyAdmin = (members?.filter((m) => m.role === "admin").length ?? 0) <= 1;

  async function leave() {
    if (await onLeave(userId)) await navigate({ to: "/dashboard/scopes" });
  }

  return (
    <DangerZone>
      <DangerRow
        title={t("scope:leaveTitle")}
        description={
          onlyAdmin ? (
            <span className="flex items-center gap-1.5 text-warning">
              <Shield className="size-4 shrink-0" />
              {t("scope:leaveOnlyAdmin")}
            </span>
          ) : (
            t("scope:leaveDescription")
          )
        }
        action={
          <Button
            type="button"
            variant="outline"
            disabled={onlyAdmin}
            onClick={() => setOpen(true)}
            className="border-danger text-danger hover:bg-danger hover:text-white disabled:opacity-50"
          >
            <LogOut className="size-4" />
            {t("scope:leaveAction")}
          </Button>
        }
      />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("scope:leaveDialogTitle")}
        description={
          <>
            {t("scope:leaveDialogPrefix")}
            <span className="font-mono">{scope}</span>
            {t("scope:leaveDialogSuffix")}
          </>
        }
        confirmLabel={t("scope:leaveAction")}
        onConfirm={leave}
      />
    </DangerZone>
  );
}
