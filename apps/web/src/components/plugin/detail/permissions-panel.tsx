import { TabsContent } from "@brika/clay/components/tabs";
import type { PluginDetail } from "@brika/registry-contract";
import { PermissionsSection } from "./permissions-section";

/** The Permissions tab: the grant-families section on its own. */
export function PermissionsPanel({
  detail,
  grantKeys,
}: Readonly<{ detail: PluginDetail; grantKeys: string[] }>) {
  return (
    <TabsContent value="permissions" className="mt-0 flex flex-col gap-7">
      {grantKeys.length > 0 ? (
        <PermissionsSection grants={detail.grants} grantKeys={grantKeys} />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-heading text-lg tracking-tight">Permissions requested</h2>
          <p className="text-muted-foreground text-sm">
            This plugin requests no permissions. It runs fully sandboxed, with no network, secret,
            or filesystem access.
          </p>
        </section>
      )}
    </TabsContent>
  );
}
