import { Tabs, TabsContent, TabsList, TabsTrigger } from "@brika/clay/components/tabs";
import { getRouteApi } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Changelog } from "@/components/clay/changelog";
import { CommentsSection } from "@/components/plugin/comments-section";
import { InstallCommand } from "@/components/plugin/install-command";
import { ReviewsSection } from "@/components/plugin/reviews-section";
import { useSocialCounts } from "@/hooks/use-social-counts";
import { useT } from "@/i18n";
import { formatCount } from "@/lib/format";
import type { RegistryPluginPage } from "@/lib/registry/registry-plugin-page";
import { DetailBreadcrumb, DetailHeader } from "./detail-header";
import { DetailSidebar } from "./detail-sidebar";
import { OverviewPanel } from "./overview-panel";
import { PermissionsPanel } from "./permissions-panel";
import { SupplyChainPanel } from "./supply-chain-panel";

export const DETAIL_TABS = [
  { id: "overview", labelKey: "pluginDetail:tabOverview" },
  { id: "permissions", labelKey: "pluginDetail:tabPermissions" },
  { id: "supply-chain", labelKey: "pluginDetail:tabSupplyChain" },
  { id: "versions", labelKey: "pluginDetail:tabVersions" },
  { id: "reviews", labelKey: "pluginDetail:tabReviews" },
  { id: "discussion", labelKey: "pluginDetail:tabDiscussion" },
] as const;
export type DetailTab = (typeof DETAIL_TABS)[number]["id"];
export const DETAIL_TAB_IDS = DETAIL_TABS.map((t) => t.id) as [DetailTab, ...DetailTab[]];

const route = getRouteApi("/$");

export function PluginDetailPage({ page }: Readonly<{ page: RegistryPluginPage }>) {
  const t = useT();
  const { lang, tab } = route.useSearch();
  const navigate = route.useNavigate();
  const activeTab: DetailTab = tab ?? "overview";
  const counts = useSocialCounts(page.detail.name);

  const onTab = (next: string) => {
    navigate({
      // `replace` so tab clicks don't pile up in history (back leaves the page, not steps tabs).
      search: (prev) => ({ ...prev, tab: next === "overview" ? undefined : (next as DetailTab) }),
      replace: true,
    });
  };

  const { detail, readme, versions, readmeLocales } = page;
  const activeLocale = lang ?? (readmeLocales.includes("en") ? "en" : (readmeLocales[0] ?? "en"));
  const displayLocales = readmeLocales;
  const grantKeys = Object.keys(detail.grants);
  const tabCounts: Partial<Record<DetailTab, number>> = {
    reviews: counts.reviews,
    discussion: counts.comments,
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <DetailBreadcrumb
        name={detail.name}
        readmeLocales={readmeLocales}
        activeLocale={activeLocale}
      />

      <DetailHeader detail={detail} displayLocales={displayLocales} />

      <InstallCommand id="install" command={`brika install ${detail.name}`} />

      <Tabs value={activeTab} onValueChange={onTab}>
        <TabsList variant="line">
          {DETAIL_TABS.map(({ id, labelKey }) => {
            const count = tabCounts[id];
            return (
              <TabsTrigger key={id} value={id}>
                {t(labelKey)}
                {count ? (
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground/70">
                    {formatCount(count)}
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_290px] lg:items-start">
          {/* main column: the active tab's panel; the sidebar persists across tabs */}
          <div className="flex min-w-0 flex-col gap-7">
            <OverviewPanel detail={detail} readme={readme} displayLocales={displayLocales} />

            <PermissionsPanel detail={detail} grantKeys={grantKeys} />

            <SupplyChainPanel detail={detail} />

            <TabsContent value="versions" className="mt-0">
              <section className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
                  <Clock className="size-4 text-muted-foreground" />
                  {t("pluginDetail:changelogHeading")}
                </h2>
                {versions.length > 0 ? (
                  <Changelog versions={versions} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t("pluginDetail:noReleaseHistory")}
                  </p>
                )}
              </section>
            </TabsContent>

            <TabsContent value="reviews" className="mt-0">
              <ReviewsSection pluginName={detail.name} fallback={[]} />
            </TabsContent>

            <TabsContent value="discussion" className="mt-0">
              <CommentsSection pluginName={detail.name} fallback={[]} />
            </TabsContent>
          </div>

          <DetailSidebar
            detail={detail}
            displayLocales={displayLocales}
            downloadsSeries={page.downloadsSeries}
          />
        </div>
      </Tabs>
    </main>
  );
}
