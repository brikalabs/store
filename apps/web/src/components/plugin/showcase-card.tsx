import type { PluginSummary } from "@brika/registry-contract";
import { Link } from "@tanstack/react-router";
import { Download, ShieldCheck, Star } from "lucide-react";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { useIconPalette } from "@/hooks/use-icon-palette";
import { useT } from "@/i18n";
import { formatCount } from "@/lib/format";

/** Total declared capabilities across a plugin's families (0 when none). */
export function capabilityTotal(plugin: PluginSummary): number {
  const c = plugin.capabilities;
  return c ? c.tools + c.blocks + c.bricks + c.sparks + c.pages : 0;
}

/** A boxed headline number + label, used in the developer/scope page stat rows. */
export function Stat({ value, label }: Readonly<{ value: string; label: string }>) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-5 py-3">
      <span className="font-bold font-heading text-foreground text-xl">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

/** A plugin tile (gradient banner, icon, name, description, install/rating/capability footer). */
export function ShowcaseCard({ plugin }: Readonly<{ plugin: PluginSummary }>) {
  const t = useT();
  // Banner accent comes from the plugin's own icon when it has one, else a hash gradient.
  const gradient = useIconPalette(plugin.iconUrl, plugin.name);
  const caps = capabilityTotal(plugin);
  return (
    <Link
      to="/$"
      params={{ _splat: plugin.name }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-brand"
    >
      <div
        className="h-[88px]"
        style={{ background: `linear-gradient(135deg, ${gradient[0]}33, ${gradient[1]}55)` }}
      />
      <div className="relative flex flex-col gap-2.5 p-[18px] pt-0">
        <div className="-mt-6 mb-1 w-fit rounded-[15px] border-[3px] border-card">
          <PluginIcon
            name={plugin.name}
            iconUrl={plugin.iconUrl}
            capabilities={plugin.capabilities}
            size={44}
          />
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-heading font-semibold text-base text-foreground">
            {plugin.displayName ?? plugin.name}
          </span>
          {plugin.verified ? <ShieldCheck className="size-3.5 shrink-0 text-brand-ink" /> : null}
          {plugin.rating ? (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground text-xs">
              <Star className="size-3 fill-[var(--color-star)] text-[var(--color-star)]" />
              {plugin.rating.average.toFixed(1)}
            </span>
          ) : null}
        </div>
        <p className="line-clamp-2 min-h-[2.3rem] text-muted-foreground text-sm leading-relaxed">
          {plugin.description ?? t("plugin:noDescription")}
        </p>
        <div className="flex items-center gap-3.5 border-border border-t pt-2.5 font-mono text-muted-foreground text-xs">
          {plugin.downloadsWeekly > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Download className="size-3" />
              {formatCount(plugin.downloadsWeekly)}
            </span>
          ) : null}
          {caps > 0 ? <span>{t("plugin:capabilitiesCount", { count: caps })}</span> : null}
        </div>
      </div>
    </Link>
  );
}
