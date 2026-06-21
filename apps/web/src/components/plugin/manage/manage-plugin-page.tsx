import type { PluginDetail } from "@brika/registry-contract";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card, SideRow } from "./card";
import { VersionsCard } from "./versions-card";

export interface ManageData {
  readonly name: string;
  /**
   * The public detail, or null when the package currently has no installable (non-yanked)
   * version. The owner must still reach this page to un-yank, so we never 404 a hosted
   * package here - the detail just becomes unavailable and the versions panel (which reads
   * every version directly) carries the management.
   */
  readonly detail: PluginDetail | null;
}

const route = getRouteApi("/dashboard/plugins/$");

export function ManagePluginPage() {
  const data = route.useLoaderData();
  const { user } = route.useRouteContext();

  if (data === null) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Listing not found</h1>
        <p className="mt-2 text-muted-foreground">
          That package isn't published to the Brika registry.
        </p>
      </main>
    );
  }

  return (
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="My plugins">
      <ManagePlugin name={data.name} detail={data.detail} />
    </AdminShell>
  );
}

function ManagePlugin({ name, detail }: Readonly<ManageData>) {
  const title = detail?.displayName ?? name;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
            <Link to="/dashboard/plugins" className="hover:text-foreground">
              My plugins
            </Link>
            <ChevronRight className="size-3" />
            {name}
          </div>
          <h1 className="mt-1.5 font-bold font-heading text-2xl tracking-tight">
            Manage · {title}
          </h1>
        </div>
      </div>

      {detail === null ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 text-sm dark:text-amber-300">
          This package has no installable version right now, so it's hidden from the storefront and
          new installs. It stays here for you to manage - un-yank a version below to relist it.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
        <div className="flex flex-col gap-5">
          <VersionsCard name={name} />
        </div>

        {/* sidebar */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-20">
          {detail ? (
            <Card>
              <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
                Synced from the registry
              </span>
              <SideRow label="Version" value={detail.version} mono />
              {detail.license ? <SideRow label="License" value={detail.license} /> : null}
              <SideRow label="Brika engine" value={detail.brikaEngine} mono />
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-muted-foreground text-xs">
                Code &amp; versions come from the published package and can't be edited here.
              </p>
            </Card>
          ) : null}

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
              Version management
            </span>
            <p className="text-muted-foreground text-xs">
              Deprecate or yank individual published versions in the{" "}
              <span className="font-semibold text-foreground">Versions</span> panel. Yanked versions
              stay installable for existing lockfiles but are hidden from new installs.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
