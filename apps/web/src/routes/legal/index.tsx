import { createFileRoute, redirect } from "@tanstack/react-router";

/** `/legal` lands on the Terms tab, which carries the document tab bar. */
export const Route = createFileRoute("/legal/")({
  beforeLoad: () => {
    throw redirect({ to: "/legal/terms" });
  },
});
