import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

/**
 * Layout for the developer console (`/dashboard` and its children: scopes, account
 * tokens, plugin editor). The server-side `beforeLoad` guard runs once here and puts the
 * signed-in `user` on the route context, which every child route inherits - so the guard
 * lives in one place and the children just render. The overview lives in
 * `dashboard.index.tsx`; this only renders the matched child via `<Outlet />`.
 */
export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: () => <Outlet />,
});
