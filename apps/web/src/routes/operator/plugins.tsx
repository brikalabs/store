import { createFileRoute } from "@tanstack/react-router";
import { OperatorPluginsPage } from "@/components/operator/operator-plugins-page";

export const Route = createFileRoute("/operator/plugins")({
  component: OperatorPluginsPage,
});
