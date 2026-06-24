import { Badge } from "@brika/clay/components/badge";
import { Card } from "@brika/clay/components/card";
import type { PluginDetail } from "@brika/registry-contract";
import { scopeOf } from "@brika/registry-core";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, ExternalLink, Link2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { GithubIcon } from "@/components/clay/icons";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { useDateFormat, useT } from "@/i18n";
import { formatBytes } from "@/lib/format";
import { DownloadsCard } from "./downloads-card";
import { sinceLabel } from "./helpers";

function MetaRow({
  label,
  value,
  mono,
}: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          mono ? "font-semibold font-mono text-foreground" : "font-semibold text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

function MetaLink({
  href,
  icon,
  children,
}: Readonly<{ href: string; icon: ReactNode; children: ReactNode }>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
    >
      <span className="text-muted-foreground">{icon}</span>
      {children}
      <ExternalLink className="ml-auto size-3.5 text-muted-foreground/60" />
    </a>
  );
}

/** External links card (repository / homepage); hidden without a repo or homepage. */
function SidebarLinks({ detail }: Readonly<{ detail: PluginDetail }>) {
  const t = useT();
  if (!detail.repository && !detail.homepage) return null;
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      {detail.repository ? (
        <MetaLink href={detail.repository} icon={<GithubIcon className="size-4" />}>
          {t("pluginDetail:linkRepository")}
        </MetaLink>
      ) : null}
      {detail.homepage ? (
        <MetaLink href={detail.homepage} icon={<Link2 className="size-4" />}>
          {t("pluginDetail:linkHomepage")}
        </MetaLink>
      ) : null}
    </Card>
  );
}

/** Author profile card; hidden when the plugin has no resolved author. */
function SidebarAuthor({ detail }: Readonly<{ detail: PluginDetail }>) {
  const t = useT();
  if (!detail.author) return null;
  // The author of a scoped package IS its scope, so show the scope's uploaded logo.
  const scope = scopeOf(detail.name);
  return (
    <Card interactive className="p-0">
      <Link
        to="/$"
        params={{ _splat: scope ?? detail.name }}
        className="flex items-center gap-3 p-4"
      >
        <GradientAvatar
          seed={detail.author.id}
          label={detail.author.name ?? detail.author.id}
          imageUrl={scope ? `/api/scopes/${encodeURIComponent(scope)}/icon` : undefined}
          size={42}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-foreground text-sm">
              {detail.author.name ?? detail.author.id}
            </span>
            {detail.verified ? <ShieldCheck className="size-3.5 shrink-0 text-brand-ink" /> : null}
          </div>
          <div className="text-muted-foreground text-xs">{t("pluginDetail:viewScope")}</div>
        </div>
      </Link>
    </Card>
  );
}

/** Keyword chips; hidden when the plugin declares no keywords. */
function SidebarKeywords({ keywords }: Readonly<{ keywords: string[] }>) {
  const t = useT();
  if (keywords.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
        {t("pluginDetail:keywords")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keywords.slice(0, 8).map((keyword) => (
          <Badge key={keyword} asChild variant="secondary">
            <Link to="/plugins" search={{ q: keyword }}>
              {keyword}
            </Link>
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** Sticky meta sidebar: install trend, the meta card, links, author, keywords. */
export function DetailSidebar({
  detail,
  displayLocales,
  downloadsSeries,
}: Readonly<{ detail: PluginDetail; displayLocales: string[]; downloadsSeries: number[] }>) {
  const t = useT();
  const date = useDateFormat();
  const hasTrend = downloadsSeries.some((value) => value > 0);
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
      {hasTrend ? (
        <DownloadsCard
          installs={detail.installs ?? 0}
          weekly={detail.downloadsWeekly}
          series={downloadsSeries}
          since={detail.publishedAt ? sinceLabel(detail.publishedAt) : undefined}
        />
      ) : null}

      <Card className="flex flex-col gap-2.5 p-4 text-sm">
        <MetaRow label={t("pluginDetail:metaVersion")} value={detail.version} mono />
        {detail.updatedAt ? (
          <MetaRow label={t("pluginDetail:metaUpdated")} value={date(detail.updatedAt)} />
        ) : null}
        {detail.publishedAt ? (
          <MetaRow label={t("pluginDetail:metaPublished")} value={date(detail.publishedAt)} />
        ) : null}
        {detail.license ? (
          <MetaRow label={t("pluginDetail:metaLicense")} value={detail.license} />
        ) : null}
        <MetaRow label={t("pluginDetail:metaBrikaEngine")} value={detail.brikaEngine} mono />
        {displayLocales.length > 0 ? (
          <MetaRow
            label={t("pluginDetail:metaLanguages")}
            value={String(displayLocales.length)}
            mono
          />
        ) : null}
        {detail.provenance ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("pluginDetail:metaProvenance")}</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="size-4" />
              {t("pluginDetail:metaSigned")}
            </span>
          </div>
        ) : null}
        {detail.unpackedSize !== undefined || detail.size !== undefined ? (
          <MetaRow
            label={t("pluginDetail:metaUnpackedSize")}
            value={formatBytes(detail.unpackedSize ?? detail.size ?? 0)}
            mono
          />
        ) : null}
      </Card>

      <SidebarLinks detail={detail} />
      <SidebarAuthor detail={detail} />
      <SidebarKeywords keywords={detail.keywords} />
    </aside>
  );
}
