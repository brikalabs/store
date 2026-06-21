import { createFileRoute } from "@tanstack/react-router";
import { OperatorPackagesPage } from "@/components/operator/operator-packages-page";

export const Route = createFileRoute("/operator/packages")({
  component: OperatorPackagesPage,
});
