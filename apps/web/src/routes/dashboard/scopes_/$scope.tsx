import { inject } from "@brika/di";
import { type ScopeManaged, ScopeService } from "@brika/registry-core";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ScopeDetailPage } from "@/components/scope/scope-detail-page";
import { getCurrentUser } from "@/lib/auth/auth";
import { runWeb } from "@/server/injector";
import { sessionIdentity } from "@/server/registry-identity";
import { requireUser } from "@/server/require-user";

// The scope's profile PLUS (for its own members) the operator takedown reason, read server-side via
// DI. The public read hides taken-down scopes, so a member would otherwise lose their settings page;
// this member-gated read keeps it loading and carries the reason for the banner.
const loadManagedScope = createServerFn()
  .validator((scope: string) => scope)
  .handler(
    ({ data: scope }): Promise<ScopeManaged | null> =>
      runWeb(async () => {
        const user = await getCurrentUser(getRequest());
        if (user === null) return null;
        const result = await inject(ScopeService).getManaged(sessionIdentity(user), scope);
        return result.ok ? result.managed : null;
      }),
  );

export const Route = createFileRoute("/dashboard/scopes_/$scope")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  loader: ({ params }) => loadManagedScope({ data: params.scope }),
  component: ScopeDetailPage,
});
