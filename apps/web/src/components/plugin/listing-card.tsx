import type { PluginSummary } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { Link } from "@tanstack/react-router";
import { Download, ShieldCheck, Star } from "lucide-react";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { VerifiedBadge } from "@/components/plugin/verified-badge";
import { useT } from "@/i18n";
import { formatCount } from "@/lib/format";

type PluginCardProps = Readonly<{ plugin: PluginSummary }>;

function capabilityTotal(plugin: PluginSummary): number {
  const c = plugin.capabilities;
  return c === undefined ? 0 : c.tools + c.blocks + c.bricks + c.sparks + c.pages;
}

export function ListingCard({ plugin }: PluginCardProps) {
  const t = useT();
  const caps = capabilityTotal(plugin);
  const handle = scopeOf(plugin.name);
  const downloads = plugin.installs ?? plugin.downloadsWeekly;
  return (
    <Link
      to="/$"
      params={{ _splat: plugin.name }}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-[18px] transition-colors hover:border-brand"
    >
      <div className="flex items-start gap-3">
        <PluginIcon
          name={plugin.name}
          iconUrl={plugin.iconUrl}
          capabilities={plugin.capabilities}
          size={44}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-heading font-semibold text-base text-foreground">
              {plugin.displayName ?? plugin.name}
            </span>
            {plugin.verified ? (
              <ShieldCheck
                className="size-3.5 shrink-0 text-brand-ink"
                aria-label={t("plugin:verified")}
              />
            ) : null}
          </div>
          {handle ? (
            <div className="flex items-center gap-0.5 text-muted-foreground text-xs">
              <span className="truncate">{plugin.author?.name ?? handle}</span>
              {plugin.author?.verified ? <VerifiedBadge className="size-3.5" /> : null}
            </div>
          ) : null}
        </div>
        {plugin.rating ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground text-xs">
            <Star className="size-3 fill-[var(--color-star)] text-[var(--color-star)]" />
            {plugin.rating.average.toFixed(1)}
          </span>
        ) : null}
      </div>
      <p className="line-clamp-2 min-h-[2.4rem] flex-1 text-muted-foreground text-sm leading-relaxed">
        {plugin.description ?? t("plugin:noDescription")}
      </p>
      <div className="flex items-center justify-between gap-3 border-border border-t pt-3 font-mono text-muted-foreground text-xs">
        <span className="rounded-md border border-border bg-muted px-2 py-1">
          v{plugin.version}
        </span>
        <div className="flex items-center gap-2">
          {downloads > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Download className="size-3" />
              {formatCount(downloads)}
            </span>
          ) : null}
          {caps > 0 ? <span>· {t("plugin:capsCount", { count: caps })}</span> : null}
        </div>
      </div>
    </Link>
  );
}
