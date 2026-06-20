import type { PluginSummary } from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Box, Pencil, ShieldCheck } from "lucide-react";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { AdminShell } from "@/components/layout/admin-shell";
import { useMyPlugins } from "@/hooks/use-my-plugins";

export const Route = createFileRoute("/dashboard/plugins/")({
  component: MyPluginsPage,
});

function MyPluginsPage() {
  const { user } = Route.useRouteContext();
  const plugins = useMyPlugins();

  return (
    <AdminShell login={user.login} activeLabel="My plugins">
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="font-bold font-heading text-2xl tracking-tight">My plugins</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Plugins published under scopes you own. Code &amp; versions come from the published
            package.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[2.4fr_1fr_1.2fr_44px] items-center gap-3 border-border border-b bg-muted/50 px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
            <span>Plugin</span>
            <span>Status</span>
            <span>Capabilities</span>
            <span />
          </div>
          {plugins.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Box className="size-7 text-muted-foreground" />
              <p className="font-medium text-foreground">No published plugins yet</p>
              <p className="text-muted-foreground text-sm">
                Plugins published under scopes you belong to show up here.
              </p>
            </div>
          ) : (
            plugins.map((plugin) => <PluginRow key={plugin.name} plugin={plugin} />)
          )}
        </div>
      </section>
    </AdminShell>
  );
}

function PluginRow({ plugin }: Readonly<{ plugin: PluginSummary }>) {
  const caps = plugin.capabilities
    ? plugin.capabilities.tools +
      plugin.capabilities.blocks +
      plugin.capabilities.bricks +
      plugin.capabilities.sparks +
      plugin.capabilities.pages
    : 0;
  return (
    <div className="grid grid-cols-[2.4fr_1fr_1.2fr_44px] items-center gap-3 border-border border-b px-5 py-3.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <PluginIcon
          name={plugin.name}
          iconUrl={plugin.iconUrl}
          capabilities={plugin.capabilities}
          size={36}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-heading font-semibold text-foreground text-sm">
              {plugin.displayName ?? plugin.name}
            </span>
            {plugin.verified ? <ShieldCheck className="size-3.5 shrink-0 text-brand-ink" /> : null}
          </div>
          <div className="font-mono text-muted-foreground text-xs">v{plugin.version}</div>
        </div>
      </div>
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-600 text-xs dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-current" />
          <span>Published</span>
        </span>
      </div>
      <div className="text-muted-foreground text-sm">{caps > 0 ? `${caps} capabilities` : "·"}</div>
      <Link
        to="/dashboard/plugins/$"
        params={{ _splat: plugin.name }}
        aria-label={`Edit ${plugin.name}`}
        className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
      >
        <Pencil className="size-4" />
      </Link>
    </div>
  );
}
