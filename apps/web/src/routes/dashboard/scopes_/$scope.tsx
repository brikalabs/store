import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { DisplayNameCard } from "@/components/scope/display-name-card";
import { DomainsCard } from "@/components/scope/domains-card";
import { LogoCard } from "@/components/scope/logo-card";
import { type Member, MembersCard } from "@/components/scope/members-card";
import { ProfileCard } from "@/components/scope/profile-card";
import { TrustedPublishersCard } from "@/components/scope/trusted-publishers-card";
import { readError, scopePath } from "@/lib/scope-api";
import { requireUser } from "@/server/require-user";

export const Route = createFileRoute("/dashboard/scopes_/$scope")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: ScopeDetailPage,
});

/**
 * Scope management shell. A scope IS the account, so it owns the one member fetch (whose
 * result decides whether the signed-in user is an admin, which gates the editor cards) and
 * delegates each concern to a card in `components/scope/*`. Cards report failures through
 * `onError` to the banner here.
 */
function ScopeDetailPage() {
  const { user } = Route.useRouteContext();
  const { scope } = Route.useParams();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    const res = await fetch(scopePath(scope, "/members"));
    if (res.ok) {
      const data: { members: Member[] } = await res.json();
      setMembers(data.members);
      setError(null);
    } else {
      setError(await readError(res));
    }
  }, [scope]);
  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const isAdmin =
    members?.find((m) => m.provider === "github" && m.id === user.login)?.role === "admin";

  return (
    <AdminShell id={user.id} name={user.name} activeLabel="Scopes">
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
      {isAdmin && <LogoCard scope={scope} onError={setError} />}
      {isAdmin && <ProfileCard scope={scope} onError={setError} />}
      {isAdmin && <DomainsCard scope={scope} onError={setError} />}
      <TrustedPublishersCard scope={scope} isAdmin={isAdmin} onError={setError} />
      <MembersCard
        scope={scope}
        members={members}
        isAdmin={isAdmin}
        onReload={loadMembers}
        onError={setError}
      />
    </AdminShell>
  );
}
