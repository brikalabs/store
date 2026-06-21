import { createFileRoute } from "@tanstack/react-router";
import { MyPluginsPage } from "@/components/plugin/my-plugins-page";

export const Route = createFileRoute("/dashboard/plugins/")({
  component: MyPluginsPage,
});
