import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/layout/legal-page";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie settings · Brika Store" },
      {
        name: "description",
        content: "The Brika store uses one essential session cookie and no tracking cookies.",
      },
    ],
  }),
  component: () => <LegalPage slug="cookies" />,
});
