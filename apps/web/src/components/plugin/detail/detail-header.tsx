import { Rating } from "@brika/clay";
import type { PluginDetail } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Download,
  Globe,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { PluginIcon } from "@/components/clay/plugin-icon";
import { Segmented, segmentClassName } from "@/components/clay/segmented";
import { ReportPluginButton } from "@/components/plugin/detail/report-dialog";
import { useT } from "@/i18n";
import { formatCount } from "@/lib/format";

/** Breadcrumb plus the locale switcher (only shown when there's more than one locale). */
export function DetailBreadcrumb({
  name,
  readmeLocales,
  activeLocale,
}: Readonly<{ name: string; readmeLocales: string[]; activeLocale: string }>) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
        <Link to="/plugins" className="hover:text-foreground">
          {t("pluginDetail:breadcrumbBrowse")}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{name}</span>
      </div>
      {readmeLocales.length > 1 ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
            <Globe className="size-3.5" />
            {t("pluginDetail:viewingIn")}
          </span>
          <Segmented>
            {readmeLocales.map((loc) => (
              <Link
                key={loc}
                to="/$"
                params={{ _splat: name }}
                search={{ lang: loc }}
                className={segmentClassName(loc === activeLocale, "sm")}
              >
                {loc.toUpperCase()}
              </Link>
            ))}
          </Segmented>
        </div>
      ) : null}
    </div>
  );
}

/** All-time installs from the registry, falling back to the trailing-week count, else nothing. */
function HeaderInstalls({ detail }: Readonly<{ detail: PluginDetail }>) {
  const t = useT();
  if (detail.installs === undefined) {
    if (detail.downloadsWeekly > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
          <Download className="size-3.5" />
          {t("pluginDetail:installsWeekly", { count: formatCount(detail.downloadsWeekly) })}
        </span>
      );
    }
    return null;
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
      <Download className="size-3.5" />
      {t("pluginDetail:installs", { count: formatCount(detail.installs) })}
    </span>
  );
}

function AddToHubButton({ command }: Readonly<{ command: string }>) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  async function add() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={add}
      className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-brand-foreground shadow-[0_8px_20px_-8px_rgba(242,84,45,0.55)] transition-opacity hover:opacity-90"
    >
      {copied ? <Check className="size-4" /> : <Plus className="size-4" />}
      {copied ? t("pluginDetail:copiedInstall") : t("pluginDetail:addToHub")}
    </button>
  );
}

/** Plugin icon, title + badges, the inline meta row, description, and the install CTA. */
export function DetailHeader({
  detail,
  displayLocales,
}: Readonly<{ detail: PluginDetail; displayLocales: string[] }>) {
  const t = useT();
  const title = detail.displayName ?? detail.name;
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <PluginIcon
        name={detail.name}
        iconUrl={detail.iconUrl}
        capabilities={detail.capabilities}
        size={60}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-bold font-heading text-3xl tracking-tight">{title}</h1>
          {detail.verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 font-semibold text-brand-ink text-xs">
              <ShieldCheck className="size-3.5" />
              {t("pluginDetail:verified")}
            </span>
          ) : null}
          {detail.featured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-600 text-xs dark:text-amber-400">
              <Sparkles className="size-3.5" />
              {t("pluginDetail:featured")}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-muted-foreground text-sm">
          {detail.author ? (
            <Link
              to="/$"
              params={{ _splat: scopeOf(detail.name) ?? detail.name }}
              className="font-semibold text-brand-ink hover:underline"
            >
              {detail.author.name ?? detail.author.id}
            </Link>
          ) : null}
          <span className="font-mono text-xs">v{detail.version}</span>
          {detail.rating ? (
            <span className="inline-flex items-center gap-1.5">
              <Rating value={detail.rating.average} color="var(--color-star)" />
              {detail.rating.average.toFixed(1)} ({detail.rating.count})
            </span>
          ) : null}
          {detail.license ? (
            <span className="inline-flex items-center gap-1">
              <Scale className="size-3.5" />
              {detail.license}
            </span>
          ) : null}
          <span className="font-mono text-xs">
            {t("pluginDetail:requiresBrika", { version: detail.brikaEngine })}
          </span>
          {displayLocales.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Globe className="size-3.5" />
              {t("pluginDetail:languagesMeta", { count: displayLocales.length })}
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
          {detail.description ?? t("pluginDetail:noDescription")}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <AddToHubButton command={`brika install ${detail.name}`} />
        <HeaderInstalls detail={detail} />
        <ReportPluginButton name={detail.name} version={detail.version} />
      </div>
    </div>
  );
}
