import { TabsContent } from "@brika/clay/components/tabs";
import type { PluginDetail } from "@brika/registry-contract";
import { useT } from "@/i18n";
import { PermissionsSection } from "./permissions-section";

/** The Permissions tab: the grant-families section on its own. */
export function PermissionsPanel({
  detail,
  grantKeys,
}: Readonly<{ detail: PluginDetail; grantKeys: string[] }>) {
  const t = useT();
  return (
    <TabsContent value="permissions" className="mt-0 flex flex-col gap-7">
      {grantKeys.length > 0 ? (
        <PermissionsSection grants={detail.grants} grantKeys={grantKeys} />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-heading text-lg tracking-tight">
            {t("pluginDetail:permissionsRequested")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("pluginDetail:noPermissions")}</p>
        </section>
      )}
    </TabsContent>
  );
}
