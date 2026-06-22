import { createFileRoute } from "@tanstack/react-router";
import { LoginCard } from "@/components/layout/login-card";

/** `/login`: provider-agnostic sign-in page; carries `?return=<path>` set by `requireUser`. */
export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    return: typeof search.return === "string" ? search.return : undefined,
  }),
  component: LoginCard,
});
