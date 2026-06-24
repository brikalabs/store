import { getRouteApi } from "@tanstack/react-router";
import { BadgeCheck, Box, Download, Star } from "lucide-react";
import { OperatorConsoleLink } from "@/components/dashboard/operator-console-link";
import { PublishCard } from "@/components/dashboard/publish-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatCard } from "@/components/dashboard/stat-card";
import { AdminShell } from "@/components/layout/admin-shell";
import { useActivity } from "@/hooks/use-activity";
import { useOwnedPlugins } from "@/hooks/use-owned-plugins";
import { useT } from "@/i18n";
import { formatCount } from "@/lib/format";

const route = getRouteApi("/dashboard/");

const NO_STATS = { total: 0, weeklyDownloads: 0, avgRating: 0, verified: 0 };

export function OverviewPage() {
  const t = useT();
  const { user } = route.useRouteContext();
  // Stats are aggregated server-side, so the overview never fetches the whole owned list (limit 1).
  const { data } = useOwnedPlugins({ limit: 1 });
  const stats = data?.stats ?? NO_STATS;
  // Recent activity is the developer's real audit events (publishes, yanks, reservations, ...).
  const activity = useActivity();
  const firstName = user.name?.split(" ")[0] ?? t("dashboard:fallbackName");

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="Overview">
      <div>
        <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
          {t("dashboard:overviewTitle")}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          {t("dashboard:overviewWelcome", { name: firstName })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard
          label={t("dashboard:statTotalPlugins")}
          value={String(stats.total)}
          icon={Box}
          accent="brand"
          to="/dashboard/plugins"
        />
        <StatCard
          label={t("dashboard:statWeeklyDownloads")}
          value={stats.weeklyDownloads > 0 ? formatCount(stats.weeklyDownloads) : "·"}
          icon={Download}
          accent="success"
        />
        <StatCard
          label={t("dashboard:statAvgRating")}
          value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "·"}
          icon={Star}
          accent="star"
        />
        <StatCard
          label={t("dashboard:statVerified")}
          value={String(stats.verified)}
          icon={BadgeCheck}
          accent="brand"
        />
      </div>

      <div className="grid items-start gap-[18px] lg:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <PublishCard />
        <div className="flex min-w-0 flex-col gap-3.5">
          <RecentActivity entries={activity ?? []} />
          <OperatorConsoleLink />
        </div>
      </div>
    </AdminShell>
  );
}
