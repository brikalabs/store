import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import content from "@/content/legal/privacy.md?raw";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy · Brika Store" },
      {
        name: "description",
        content: "What data the Brika store and registry collect, and how we handle it.",
      },
    ],
  }),
  component: () => <LegalPage slug="privacy" content={content} />,
});
