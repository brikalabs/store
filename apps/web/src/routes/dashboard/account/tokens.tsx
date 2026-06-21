import { createFileRoute } from "@tanstack/react-router";
import { TokensPage } from "@/components/account/tokens-page";
import { requireUser } from "@/server/require-user";

export const Route = createFileRoute("/dashboard/account/tokens")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: TokensPage,
});
