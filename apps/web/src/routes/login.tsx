import { createFileRoute } from "@tanstack/react-router";
import { LoginCard } from "@/components/layout/login-card";

/**
 * `/login`: the provider-agnostic sign-in page (USER/AUTH). `requireUser` redirects here with
 * `?return=<path>` when a console route is hit signed-out; the card lists the configured providers
 * and carries the return through to whichever the user picks.
 */
export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    return: typeof search.return === "string" ? search.return : undefined,
  }),
  component: LoginCard,
});
