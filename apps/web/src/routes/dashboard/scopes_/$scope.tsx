import { createFileRoute } from "@tanstack/react-router";
import { ScopeDetailPage } from "@/components/scope/scope-detail-page";
import { requireUser } from "@/server/require-user";

export const Route = createFileRoute("/dashboard/scopes_/$scope")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: ScopeDetailPage,
});
