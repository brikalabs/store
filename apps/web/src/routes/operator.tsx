import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireOperator } from "@/server/require-operator";

/**
 * Layout + gate for the operator console (`/operator` and its children: scopes, packages,
 * audit). The `requireOperator` guard runs once here in `beforeLoad` and throws `notFound()`
 * for anyone who is not a registry operator, so the section's existence is not advertised.
 * Children inherit the gate and render their own {@link OperatorShell}; this only renders
 * the matched child.
 */
export const Route = createFileRoute("/operator")({
  beforeLoad: async () => ({ operator: await requireOperator() }),
  component: () => <Outlet />,
});
