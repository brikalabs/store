import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/layout/legal-page";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service · Brika Store" },
      {
        name: "description",
        content: "The terms that govern use of the Brika store and plugin registry.",
      },
    ],
  }),
  component: () => <LegalPage slug="terms" />,
});
