import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { DisplayNameCard } from "@/components/org/display-name-card";
import { DomainsCard } from "@/components/org/domains-card";
import { LogoCard } from "@/components/org/logo-card";
import { type Member, MembersCard } from "@/components/org/members-card";
import { ProfileCard } from "@/components/org/profile-card";
import { ScopesCard } from "@/components/org/scopes-card";
import { orgPath, readError } from "@/lib/org-api";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/dashboard/orgs_/$org")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: OrgDetailPage,
});

/**
 * Org management shell. It owns the one member fetch (whose result decides whether the
 * signed-in user is an admin, which gates the editor cards) and delegates each concern to
 * a card in `components/org/*`. Cards report failures through `onError` to the banner here.
 */
function OrgDetailPage() {
  const { user } = Route.useRouteContext();
  const { org } = Route.useParams();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    const res = await fetch(orgPath(org, "/members"));
    if (res.ok) {
      const data: { members: Member[] } = await res.json();
      setMembers(data.members);
      setError(null);
    } else {
      setError(await readError(res));
    }
  }, [org]);
  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const isAdmin =
    members?.find((m) => m.provider === "github" && m.id === user.login)?.role === "admin";

  return (
    <AdminShell login={user.login} activeLabel="Organisations">
      <div>
        <Link
          to="/dashboard/orgs"
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All organisations
        </Link>
        <h1 className="mt-2 font-mono font-bold text-2xl tracking-tight">{org}</h1>
      </div>

      {error !== null && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          {error}
        </p>
      )}

      {isAdmin && <DisplayNameCard org={org} onError={setError} />}
      {isAdmin && <LogoCard org={org} onError={setError} />}
      {isAdmin && <ProfileCard org={org} onError={setError} />}
      {isAdmin && <DomainsCard org={org} onError={setError} />}
      <ScopesCard org={org} isAdmin={isAdmin} onError={setError} />
      <MembersCard
        org={org}
        members={members}
        isAdmin={isAdmin}
        onReload={loadMembers}
        onError={setError}
      />
    </AdminShell>
  );
}
