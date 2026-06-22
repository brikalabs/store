import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireUser } from "@/server/require-user";

/** Developer console layout: the `beforeLoad` guard puts the signed-in `user` on the
 * route context once, which every child route inherits. */
export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  component: () => <Outlet />,
});
