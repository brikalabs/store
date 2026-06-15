import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "../components/legal-page";
import content from "../content/legal/acceptable-use.md?raw";

export const Route = createFileRoute("/legal/acceptable-use")({
  head: () => ({
    meta: [
      { title: "Acceptable Use Policy · Brika Store" },
      {
        name: "description",
        content: "What may be published to the Brika registry and how the services may be used.",
      },
    ],
  }),
  component: () => <LegalPage slug="acceptable-use" content={content} />,
});
