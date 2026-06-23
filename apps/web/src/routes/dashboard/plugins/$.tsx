import { inject } from "@brika/di";
import { MetadataReader } from "@brika/registry-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { type ManageData, ManagePluginPage } from "@/components/plugin/manage/manage-plugin-page";
import { getPluginPage } from "@/lib/registry/registry";
import { isRegistryName } from "@/lib/registry/registry-source";
import { runWeb } from "@/server/injector";
import { requireUser } from "@/server/require-user";

// A reserved name is a package row with no versions, which only the raw metadata (read via DI) can
// tell from a hidden/all-yanked one. So this part runs as a server function; it returns a plain
// boolean so it serializes cleanly, and the loader fetches the public detail separately.
const isReserved = createServerFn()
  .validator((name: string) => name)
  .handler(({ data: name }) =>
    runWeb(async (): Promise<boolean> => {
      const record = await inject(MetadataReader).getPackage(name);
      return record !== null && record.versions.length === 0;
    }),
  );

export const Route = createFileRoute("/dashboard/plugins/$")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  loader: async ({ params }): Promise<ManageData | null> => {
    const name = params._splat;
    if (!name || !isRegistryName(name)) return null;
    const reserved = await isReserved({ data: name });
    const detail = reserved ? null : ((await getPluginPage(name))?.detail ?? null);
    return { name, detail, reserved };
  },
  component: ManagePluginPage,
});
