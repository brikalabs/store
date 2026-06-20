import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import content from "@/content/legal/licenses.md?raw";

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
  component: () => <LegalPage slug="licenses" content={content} />,
});
