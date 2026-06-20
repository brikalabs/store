import { createFileRoute, redirect } from "@tanstack/react-router";

/** `/operator` lands on the scopes directory (the gate runs in the parent layout). */
export const Route = createFileRoute("/operator/")({
  beforeLoad: () => {
    throw redirect({ to: "/operator/scopes" });
  },
});
