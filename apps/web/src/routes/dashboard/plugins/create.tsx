import { createFileRoute } from "@tanstack/react-router";
import { CreatePluginPage } from "@/components/plugin/create-plugin-page";

export const Route = createFileRoute("/dashboard/plugins/create")({
  component: CreatePluginPage,
});
