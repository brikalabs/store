import { createFileRoute } from "@tanstack/react-router";
import { ScopeDetailPage } from "@/components/scope/scope-detail-page";
import { getRegistryScope } from "@/lib/registry/registry-source";
import { requireUser } from "@/server/require-user";

export const Route = createFileRoute("/dashboard/scopes_/$scope")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  // The scope's current profile (display name, ...) so the settings cards show what's already set.
  loader: ({ params }) => getRegistryScope(params.scope),
  component: ScopeDetailPage,
});
