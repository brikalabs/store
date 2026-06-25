import type { PluginSummary } from "@brika/registry-contract";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { useT } from "@/i18n";

export function HeroCard({ plugin }: Readonly<{ plugin: PluginSummary }>) {
  const t = useT();
  return (
    <Link
      to="/$"
      params={{ _splat: plugin.name }}
      className="group flex flex-col gap-4 rounded-[18px] border border-border bg-card p-6 shadow-[0_24px_50px_-24px_rgba(30,20,10,0.3)] transition-transform hover:-translate-y-1"
    >
      <div className="flex items-center gap-3.5">
        <PluginIcon
          name={plugin.name}
          iconUrl={plugin.iconUrl}
          capabilities={plugin.capabilities}
          size={52}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-bold font-heading text-foreground text-lg">
              {plugin.displayName ?? plugin.name}
            </span>
            {plugin.verified ? <ShieldCheck className="size-4 shrink-0 text-brand-ink" /> : null}
          </div>
          {plugin.author ? (
            <p className="truncate text-muted-foreground text-sm">
              {t("home:byAuthor", { author: plugin.author.id })}
            </p>
          ) : null}
        </div>
      </div>
      <p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
        {plugin.description ?? t("home:noDescription")}
      </p>
      <div className="flex items-center justify-between pt-1">
        <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-muted-foreground text-xs">
          v{plugin.version}
        </span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-brand-ink text-sm">
          {t("home:viewPlugin")}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
