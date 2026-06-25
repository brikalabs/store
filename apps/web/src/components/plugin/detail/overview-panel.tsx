import { TabsContent } from "@brika/clay/components/tabs";
import type { PluginDetail } from "@brika/registry-contract";
import { CapabilityChips } from "@/components/clay/capability-chips";
import { ScreenshotPanels } from "@/components/clay/screenshot-panels";
import { Markdown } from "@/components/plugin/markdown";
import { useT } from "@/i18n";
import { LocalizationSection } from "./localization-section";

/** The Overview tab's main column: screenshots, capabilities, languages, and about. */
export function OverviewPanel({
  detail,
  readme,
  displayLocales,
}: Readonly<{
  detail: PluginDetail;
  readme: string | null;
  displayLocales: string[];
}>) {
  const t = useT();
  const screenshotCount = detail.screenshots.length;
  return (
    <TabsContent value="overview" className="mt-0 flex flex-col gap-7">
      {screenshotCount > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold font-heading text-lg tracking-tight">
              {t("pluginDetail:screenshotsHeading")}
            </h2>
            <span className="text-muted-foreground text-xs">
              {t("pluginDetail:screenshotsCount", { count: screenshotCount })}
            </span>
          </div>
          <ScreenshotPanels
            images={detail.screenshots.map((shot) => shot.url)}
            seed={detail.name}
          />
        </section>
      ) : null}

      {detail.capabilities ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-heading text-lg tracking-tight">
            {t("pluginDetail:capabilitiesHeading")}
          </h2>
          <CapabilityChips capabilities={detail.capabilities} />
        </section>
      ) : null}

      <LocalizationSection displayLocales={displayLocales} />

      {readme ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-heading text-lg tracking-tight">
            {t("pluginDetail:aboutHeading")}
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Markdown>{readme}</Markdown>
          </div>
        </section>
      ) : null}
    </TabsContent>
  );
}
