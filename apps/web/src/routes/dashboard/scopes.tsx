import { createFileRoute } from "@tanstack/react-router";
import { ScopesPage } from "@/components/scope/scopes-page";
import { requireUser } from "@/server/require-user";

export const Route = createFileRoute("/dashboard/scopes")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: ScopesPage,
});
