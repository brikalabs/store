import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireOperator } from "@/server/require-operator";

/** Operator console layout + gate: `requireOperator` throws `notFound()` for non-operators,
 * so the section's existence is not advertised. Children inherit the gate. */
export const Route = createFileRoute("/operator")({
  beforeLoad: async () => ({ operator: await requireOperator() }),
  component: () => <Outlet />,
});
