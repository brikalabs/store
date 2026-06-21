import { createFileRoute } from "@tanstack/react-router";
import { OperatorScopesPage } from "@/components/operator/operator-scopes-page";

export const Route = createFileRoute("/operator/scopes")({
  component: OperatorScopesPage,
});
