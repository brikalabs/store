import type { PluginSummary } from "@brika/registry-contract";
import { Link } from "@tanstack/react-router";
import { Download, ShieldCheck } from "lucide-react";
import { formatCount } from "../lib/format";
import { PluginIcon } from "./clay/plugin-icon";
import { Stars } from "./clay/stars";

type PluginCardProps = Readonly<{ plugin: PluginSummary }>;

function capabilityTotal(plugin: PluginSummary): number {
  const c = plugin.capabilities;
  if (c === undefined) return 0;
  return c.tools + c.blocks + c.bricks + c.sparks + c.pages;
}

export function PluginCard({ plugin }: PluginCardProps) {
  const capabilities = capabilityTotal(plugin);
  return (
    <Link
      to="/plugins/$"
      params={{ _splat: plugin.name }}
      className="group flex h-full flex-col gap-3.5 rounded-2xl border border-border bg-card p-[18px] transition-colors hover:border-brand"
    >
      <div className="flex items-center gap-3">
        <PluginIcon
          name={plugin.name}
          iconUrl={plugin.iconUrl}
          capabilities={plugin.capabilities}
          size={44}
        />
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-heading font-semibold text-base text-foreground">
            {plugin.displayName ?? plugin.name}
          </span>
          {plugin.verified ? (
            <ShieldCheck className="size-3.5 shrink-0 text-brand-ink" aria-label="Verified" />
          ) : null}
        </div>
      </div>
      <p className="line-clamp-2 min-h-[2.4rem] flex-1 text-muted-foreground text-sm leading-relaxed">
        {plugin.description ?? "No description provided."}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-3 font-mono text-muted-foreground text-xs">
        <span className="rounded-md border border-border bg-muted px-2 py-1">
          v{plugin.version}
        </span>
        {plugin.downloadsWeekly > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Download className="size-3" />
            {formatCount(plugin.downloadsWeekly)}
          </span>
        ) : null}
        {plugin.rating ? (
          <span className="inline-flex items-center gap-1 text-amber-500">
            <Stars value={plugin.rating.average} starClassName="size-3" />
            {plugin.rating.average.toFixed(1)}
          </span>
        ) : capabilities > 0 ? (
          <span>{capabilities} capabilities</span>
        ) : null}
      </div>
    </Link>
  );
}
