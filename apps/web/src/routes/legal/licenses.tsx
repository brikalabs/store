import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/layout/legal-page";

export const Route = createFileRoute("/legal/licenses")({
  head: () => ({
    meta: [
      { title: "Content and licensing · Brika Store" },
      {
        name: "description",
        content: "Who owns published packages and the license you grant when you publish.",
      },
    ],
  }),
  component: () => <LegalPage slug="licenses" />,
});
