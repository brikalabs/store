import { createFileRoute } from "@tanstack/react-router";
import { type ManageData, ManagePluginPage } from "@/components/plugin/manage/manage-plugin-page";
import { getPluginPage } from "@/lib/registry/registry";
import { isRegistryName } from "@/lib/registry/registry-source";
import { requireUser } from "@/server/require-user";

export const Route = createFileRoute("/dashboard/plugins/$")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  loader: async ({ params }): Promise<ManageData | null> => {
    const name = params._splat;
    if (!name || !isRegistryName(name)) return null;
    return { name, detail: (await getPluginPage(name))?.detail ?? null };
  },
  component: ManagePluginPage,
});
