import { createFileRoute } from "@tanstack/react-router";
import { AccountsPage } from "@/components/account/accounts-page";
import { requireUser } from "@/server/require-user";

export const Route = createFileRoute("/dashboard/accounts")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: AccountsPage,
});
