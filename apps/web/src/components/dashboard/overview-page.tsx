import { getRouteApi, Link } from "@tanstack/react-router";
import { Box } from "lucide-react";
import { OperatorConsoleLink } from "@/components/dashboard/operator-console-link";
import { PublishCard } from "@/components/dashboard/publish-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { AdminShell } from "@/components/layout/admin-shell";
import { useMyPlugins } from "@/hooks/use-my-plugins";
import { formatCount } from "@/lib/format";

const route = getRouteApi("/dashboard/");

export function OverviewPage() {
  const { user } = route.useRouteContext();
  const plugins = useMyPlugins();

  const weekly = plugins.reduce((sum, p) => sum + p.downloadsWeekly, 0);
  const rated = plugins.filter((p) => p.rating);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, p) => sum + (p.rating?.average ?? 0), 0) / rated.length
      : 0;
  const verified = plugins.filter((p) => p.verified).length;

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="Overview">
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="font-bold font-heading text-2xl tracking-tight">Overview</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Welcome back, {user.name ?? "there"}. Here's how your plugins are doing.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <StatCard label="Total plugins" value={String(plugins.length)} to="/dashboard/plugins" />
          <StatCard label="Weekly downloads" value={weekly > 0 ? formatCount(weekly) : "·"} />
          <StatCard label="Avg rating" value={avgRating > 0 ? avgRating.toFixed(1) : "·"} />
          <StatCard label="Verified" value={String(verified)} />
        </div>

        <Link
          to="/dashboard/plugins"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-semibold text-foreground text-sm transition-colors hover:bg-muted"
        >
          <Box className="size-4 text-brand-ink" />
          Manage my plugins
        </Link>

        <OperatorConsoleLink />
      </section>

      <PublishCard />
    </AdminShell>
  );
}
