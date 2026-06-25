import { inject } from "@brika/di";
import { OwnershipPolicy } from "@brika/registry-core";
import { MetadataReader } from "@brika/registry-runtime";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { type ManageData, ManagePluginPage } from "@/components/plugin/manage/manage-plugin-page";
import { getCurrentUser } from "@/lib/auth/auth";
import { getPluginPage } from "@/lib/registry/registry";
import { isRegistryName } from "@/lib/registry/registry-http";
import { runWeb } from "@/server/injector";
import { sessionIdentity } from "@/server/registry-identity";
import { requireUser } from "@/server/require-user";

// The owner's view of a hosted name, from the raw metadata via DI (the public catalog hides reserved
// and taken-down packages, so the loader can't learn either from it): whether it is just a reserved
// name, and the operator takedown reason (whole-plugin or its owning scope) - revealed ONLY to a
// member of the owning scope, so the reason never leaks to a stranger. Runs server-side.
const ownerMeta = createServerFn()
  .validator((name: string) => name)
  .handler(
    ({ data: name }): Promise<{ reserved: boolean; takedown: string | null }> =>
      runWeb(async () => {
        const record = await inject(MetadataReader).getPackage(name);
        if (record === null) return { reserved: false, takedown: null };
        const reserved = record.versions.length === 0;
        const reason = record.takedown ?? record.scopeTakedown;
        if (reason === null) return { reserved, takedown: null };
        const user = await getCurrentUser(getRequest());
        const member =
          user !== null &&
          (await inject(OwnershipPolicy).canPublish(sessionIdentity(user), name)).ok;
        return { reserved, takedown: member ? reason : null };
      }),
  );

export const Route = createFileRoute("/dashboard/plugins/$")({
  beforeLoad: async ({ location }) => ({ user: await requireUser(location.href) }),
  loader: async ({ params }): Promise<ManageData | null> => {
    const name = params._splat;
    if (!name || !isRegistryName(name)) return null;
    const { reserved, takedown } = await ownerMeta({ data: name });
    const detail = reserved ? null : ((await getPluginPage(name))?.detail ?? null);
    return { name, detail, reserved, takedown };
  },
  component: ManagePluginPage,
});
