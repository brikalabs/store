import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/components/dashboard/overview-page";

export const Route = createFileRoute("/dashboard/")({
  component: OverviewPage,
});
