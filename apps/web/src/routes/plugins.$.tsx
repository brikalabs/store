import { Badge } from "@brika/clay/components/badge";
import { Card } from "@brika/clay/components/card";
import { Chart } from "@brika/clay/components/chart";
import { Status, StatusIndicator, StatusLabel } from "@brika/clay/components/status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@brika/clay/components/tabs";
import type { PluginDetail } from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Box,
  Check,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Globe,
  Layers,
  Link2,
  type LucideIcon,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { z } from "zod";
import { CapabilityChips } from "../components/clay/capability-chips";
import { Changelog } from "../components/clay/changelog";
import { GithubIcon } from "../components/clay/icons";
import { GradientAvatar, PluginIcon } from "../components/clay/plugin-icon";
import { placeholderShotCount, ScreenshotPanels } from "../components/clay/screenshot-panels";
import { Segmented, segmentClassName } from "../components/clay/segmented";
import { Stars } from "../components/clay/stars";
import { CommentsSection } from "../components/comments-section";
import { CopyButton } from "../components/copy-button";
import { NotFoundPage } from "../components/error-pages";
import { InstallCommand } from "../components/install-command";
import { Markdown } from "../components/markdown";
import { ReviewsSection } from "../components/reviews-section";
import { demoLocales } from "../lib/demo";
import { formatCount, formatDate } from "../lib/format";
import { mockComments, mockReviews } from "../lib/mock-social";
import { getPluginPage } from "../lib/registry";
import { isRegistryName } from "../lib/registry-source";

const DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "versions", label: "Versions" },
  { id: "reviews", label: "Reviews" },
  { id: "discussion", label: "Discussion" },
] as const;
type DetailTab = (typeof DETAIL_TABS)[number]["id"];
const DETAIL_TAB_IDS = DETAIL_TABS.map((t) => t.id) as [DetailTab, ...DetailTab[]];

// The active tab lives in the URL (`?tab=`), so it is deep-linkable and the back
// button steps through panels. Invalid/absent -> Overview (kept out of the URL).
const detailSearch = z.object({
  lang: z.string().optional(),
  tab: z.enum(DETAIL_TAB_IDS).optional().catch(undefined),
});

export const Route = createFileRoute("/plugins/$")({
  validateSearch: (input) => detailSearch.parse(input),
  loaderDeps: ({ search }) => ({ lang: search.lang }),
  loader: ({ params, deps }) => (params._splat ? getPluginPage(params._splat, deps.lang) : null),
  component: PluginDetailPage,
});

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  ja: "日本語",
  zh: "中文",
  pt: "Português",
  it: "Italiano",
  nl: "Nederlands",
  ko: "한국어",
};

const PERMISSION_ICONS: LucideIcon[] = [Link2, ShieldCheck, Box];

function localeName(code: string): string {
  return LOCALE_NAMES[code] ?? code.toUpperCase();
}

/**
 * Dependencies table from the real manifest (package -> required range), with a
 * brand marker on `@brika/*` deps, the peer engine, and a dev-dependency count.
 * Hidden when the plugin declares no dependencies and no peers.
 */
function DependenciesSection({
  dependencies,
  peerDependencies,
  devDependencyCount,
  brikaEngine,
}: Readonly<{
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencyCount?: number;
  brikaEngine: string;
}>) {
  const deps = Object.entries(dependencies ?? {});
  const peers: [string, string][] = [
    ["brika", brikaEngine],
    ...Object.entries(peerDependencies ?? {}).filter(([name]) => name !== "brika"),
  ];
  if (deps.length === 0 && Object.keys(peerDependencies ?? {}).length === 0) {
    // Still show the brika peer for context, but no table.
    return (
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
          <Layers className="size-4 text-muted-foreground" />
          Dependencies
          <span className="font-medium text-muted-foreground text-sm">0</span>
        </h2>
        <p className="text-muted-foreground text-sm">
          No runtime dependencies. Peers{" "}
          <span className="font-mono text-foreground">brika@{brikaEngine}</span>.
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
          <Layers className="size-4 text-muted-foreground" />
          Dependencies
          <span className="font-medium text-muted-foreground text-sm">{deps.length}</span>
        </h2>
        {devDependencyCount ? (
          <span className="text-muted-foreground text-xs">
            {devDependencyCount} dev dependencies
          </span>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1.6fr_1fr] gap-3 border-border border-b bg-muted px-4 py-2.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.04em]">
          <span>Package</span>
          <span>Required</span>
        </div>
        {deps.map(([name, range]) => (
          <div
            key={name}
            className="grid grid-cols-[1.6fr_1fr] items-center gap-3 border-border border-b px-4 py-2.5 last:border-b-0"
          >
            <span className="inline-flex min-w-0 items-center gap-2 font-mono text-brand text-xs">
              <Box className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{name}</span>
              {name.startsWith("@brika/") ? (
                <ShieldCheck className="size-3 shrink-0 text-brand" />
              ) : null}
            </span>
            <span className="font-mono text-foreground text-xs">{range}</span>
          </div>
        ))}
        {peers.map(([name, range]) => (
          <div
            key={name}
            className="flex items-center gap-2 px-4 py-2.5 text-muted-foreground text-xs"
          >
            <Link2 className="size-3.5" /> Peer:{" "}
            <span className="font-mono text-foreground">
              {name}@{range}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Breadcrumb plus the locale switcher (only shown when there's more than one locale). */
function DetailBreadcrumb({
  name,
  readmeLocales,
  activeLocale,
}: Readonly<{ name: string; readmeLocales: string[]; activeLocale: string }>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
        <Link to="/plugins" className="hover:text-foreground">
          Browse
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{name}</span>
      </div>
      {readmeLocales.length > 1 ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
            <Globe className="size-3.5" />
            Viewing in
          </span>
          <Segmented>
            {readmeLocales.map((loc) => (
              <Link
                key={loc}
                to="/plugins/$"
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

/** Plugin icon, title + badges, the inline meta row, description, and the install CTA. */
function DetailHeader({
  detail,
  displayLocales,
}: Readonly<{ detail: PluginDetail; displayLocales: string[] }>) {
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
              Verified
            </span>
          ) : null}
          {detail.featured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-600 text-xs dark:text-amber-400">
              <Sparkles className="size-3.5" />
              Featured
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-muted-foreground text-sm">
          {detail.author ? (
            <Link
              to="/developers/$id"
              params={{ id: detail.author.id }}
              className="font-semibold text-brand-ink hover:underline"
            >
              {detail.author.id}
            </Link>
          ) : null}
          <span className="font-mono text-xs">v{detail.version}</span>
          {detail.rating ? (
            <span className="inline-flex items-center gap-1.5">
              <Stars value={detail.rating.average} />
              {detail.rating.average.toFixed(1)} ({detail.rating.count})
            </span>
          ) : null}
          {detail.license ? (
            <span className="inline-flex items-center gap-1">
              <Scale className="size-3.5" />
              {detail.license}
            </span>
          ) : null}
          <span className="font-mono text-xs">requires brika {detail.brikaEngine}</span>
          {displayLocales.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Globe className="size-3.5" />
              {displayLocales.length} languages
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
          {detail.description ?? "No description provided."}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <AddToHubButton command={`brika install ${detail.name}`} />
        {detail.installs !== undefined ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
            <Download className="size-3.5" />
            {formatCount(detail.installs)} installs
          </span>
        ) : detail.downloadsWeekly > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
            <Download className="size-3.5" />
            {formatCount(detail.downloadsWeekly)} installs / week
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** "Localization" section listing the languages a plugin ships; hidden when none. */
function LocalizationSection({ displayLocales }: Readonly<{ displayLocales: string[] }>) {
  if (displayLocales.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
        <Globe className="size-4 text-muted-foreground" />
        Localization
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Ships translations for <strong className="text-foreground">{displayLocales.length}</strong>{" "}
        {displayLocales.length === 1 ? "language" : "languages"}. Brika picks the active locale from
        the hub at runtime, falling back to English.
      </p>
      <div className="flex flex-wrap gap-2">
        {displayLocales.map((loc) => (
          <span
            key={loc}
            className="rounded-[9px] border border-border bg-card px-3 py-1.5 font-medium text-foreground text-sm"
          >
            {localeName(loc)}
            {loc === "en" ? (
              <span className="ml-1.5 font-semibold text-[10px] text-muted-foreground">
                DEFAULT
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </section>
  );
}

/** "Permissions requested" section; hidden when the plugin requests no grants. */
function PermissionsSection({
  grants,
  grantKeys,
}: Readonly<{ grants: PluginDetail["grants"]; grantKeys: string[] }>) {
  if (grantKeys.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold font-heading text-lg tracking-tight">Permissions requested</h2>
      <div className="flex flex-col gap-2.5">
        {grantKeys.map((grant, index) => {
          const Icon = PERMISSION_ICONS[index % PERMISSION_ICONS.length] as LucideIcon;
          const description = (grants[grant] as { description?: string } | undefined)?.description;
          return (
            <div
              key={grant}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="font-mono text-foreground text-sm">{grant}</div>
                {description ? (
                  <div className="text-muted-foreground text-xs">{description}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** External links card (repository / homepage / npm); hidden without a repo or homepage. */
function SidebarLinks({ detail }: Readonly<{ detail: PluginDetail }>) {
  if (!detail.repository && !detail.homepage) return null;
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      {detail.repository ? (
        <MetaLink href={detail.repository} icon={<GithubIcon className="size-4" />}>
          Repository
        </MetaLink>
      ) : null}
      {detail.homepage ? (
        <MetaLink href={detail.homepage} icon={<Link2 className="size-4" />}>
          Homepage
        </MetaLink>
      ) : null}
      {/* `@brika/*` are hosted on our registry, not npm, so no npm link for them. */}
      {isRegistryName(detail.name) ? null : (
        <MetaLink
          href={`https://www.npmjs.com/package/${detail.name}`}
          icon={<Box className="size-4" />}
        >
          npm package
        </MetaLink>
      )}
    </Card>
  );
}

/** Author profile card; hidden when the plugin has no resolved author. */
function SidebarAuthor({ detail }: Readonly<{ detail: PluginDetail }>) {
  if (!detail.author) return null;
  return (
    <Card interactive className="p-0">
      <Link
        to="/developers/$id"
        params={{ id: detail.author.id }}
        className="flex items-center gap-3 p-4"
      >
        <GradientAvatar
          seed={detail.author.id}
          label={detail.author.name ?? detail.author.id}
          size={42}
          className="rounded-[11px]"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-foreground text-sm">
              {detail.author.id}
            </span>
            {detail.verified ? <ShieldCheck className="size-3.5 shrink-0 text-brand-ink" /> : null}
          </div>
          <div className="text-muted-foreground text-xs">View profile</div>
        </div>
      </Link>
    </Card>
  );
}

/** Keyword chips; hidden when the plugin declares no keywords. */
function SidebarKeywords({ keywords }: Readonly<{ keywords: string[] }>) {
  if (keywords.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
        Keywords
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

/** A label/value row in the provenance grid; value may be a link. */
function ProvenanceRow({
  label,
  href,
  children,
}: Readonly<{ label: string; href?: string; children: ReactNode }>) {
  const value = href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="truncate font-mono text-brand text-xs underline decoration-1 underline-offset-2"
    >
      {children}
    </a>
  ) : (
    <span className="truncate font-mono text-foreground text-xs">{children}</span>
  );
  return (
    <>
      <span className="font-semibold text-foreground text-xs">{label}</span>
      {value}
    </>
  );
}

/** The repo path from a GitHub OIDC `workflow_ref` (`owner/repo/<path>@ref`). */
function workflowPath(workflowRef: string): string {
  const beforeRef = workflowRef.split("@")[0] ?? workflowRef;
  const parts = beforeRef.split("/");
  return parts.length > 2 ? parts.slice(2).join("/") : beforeRef;
}

/** Built-from-CI block, anchored on the verified OIDC token (cannot be forged). */
function ProvenanceBlock({ provenance }: Readonly<{ provenance: PluginDetail["provenance"] }>) {
  if (provenance === undefined) return null;
  const { repository, sha, ref, workflowRef, runId } = provenance;
  const repoUrl = `https://github.com/${repository}`;
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-x-7 gap-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs">Built and signed on</span>
        <span className="inline-flex items-center gap-2 font-bold font-heading text-base text-foreground">
          <ShieldCheck className="size-4 text-emerald-500" />
          GitHub Actions
        </span>
        {runId ? (
          <a
            href={`${repoUrl}/actions/runs/${runId}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-foreground text-xs underline underline-offset-2"
          >
            View build summary
          </a>
        ) : null}
      </div>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5">
        <ProvenanceRow label="Source commit" href={sha ? `${repoUrl}/commit/${sha}` : repoUrl}>
          {repository}
          {sha ? `@${sha.slice(0, 7)}` : ""}
        </ProvenanceRow>
        {workflowRef ? (
          <ProvenanceRow
            label="Build file"
            href={
              ref
                ? `${repoUrl}/blob/${ref.replace("refs/heads/", "")}/${workflowPath(workflowRef)}`
                : repoUrl
            }
          >
            {workflowPath(workflowRef)}
          </ProvenanceRow>
        ) : null}
        {ref ? <ProvenanceRow label="Ref">{ref}</ProvenanceRow> : null}
        {provenance.transparencyLog ? (
          <ProvenanceRow label="Transparency log" href={provenance.transparencyLog.logUrl}>
            Verify on {provenance.transparencyLog.provider}
            {provenance.transparencyLog.logIndex
              ? ` · #${provenance.transparencyLog.logIndex}`
              : ""}
          </ProvenanceRow>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Main-column "Integrity & provenance" section (npm-style): the tarball's SHA-512
 * Subresource Integrity (with a copy button) plus, for CI-published versions, the
 * build provenance derived from the verified GitHub OIDC token.
 */
function IntegrityProvenanceSection({
  integrity,
  provenance,
}: Readonly<{ integrity: string; provenance: PluginDetail["provenance"] }>) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
        <ShieldCheck className="size-4 text-emerald-500" />
        Integrity &amp; provenance
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        The integrity hash lets your hub verify the download has not been tampered with. A published
        version is immutable, and bun pins this hash in your lockfile.
      </p>
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card p-3.5">
        <span className="min-w-16 font-semibold text-muted-foreground text-xs">Integrity</span>
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-foreground text-xs">
          {integrity}
        </code>
        <CopyButton value={integrity} />
      </div>
      <ProvenanceBlock provenance={provenance} />
    </section>
  );
}

/** Running total of a per-day series, as the `{ts, value}` points the Chart plots. */
function cumulativePoints(series: number[]): { ts: number; value: number }[] {
  let sum = 0;
  return series.map((value, index) => {
    sum += value;
    return { ts: index, value: sum };
  });
}

/** Week-over-week install trend (%): last 7 days vs the prior 7. */
function weekTrend(series: number[]): number {
  const n = series.length;
  const sum = (from: number, to: number) =>
    series.slice(Math.max(0, from), Math.max(0, to)).reduce((a, b) => a + b, 0);
  const recent = sum(n - 7, n);
  const prior = sum(n - 14, n - 7);
  if (prior === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - prior) / prior) * 100);
}

/**
 * Total-installs card with a real download trend, drawn with the Clay chart kit.
 * Shown only when the registry has install history (npm carries no per-day series).
 */
function DownloadsCard({
  installs,
  weekly,
  series,
}: Readonly<{ installs: number; weekly: number; series: number[] }>) {
  const trend = weekTrend(series);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
            Total installs
          </span>
          <span className="font-bold font-heading text-2xl text-foreground leading-tight">
            {formatCount(installs)}
          </span>
        </div>
        {trend !== 0 ? (
          <Status variant={trend > 0 ? "success" : "destructive"}>
            <StatusIndicator pulse={false} />
            <StatusLabel>
              {trend > 0 ? "+" : ""}
              {trend}%
            </StatusLabel>
          </Status>
        ) : null}
      </div>
      <div className="h-24">
        <Chart
          data={cumulativePoints(series)}
          color="var(--color-brand)"
          formatValue={formatCount}
          formatX={(ts) => `Day ${Math.round(ts) + 1}`}
        />
      </div>
      <div className="flex justify-between font-mono text-muted-foreground text-xs">
        <span>{formatCount(weekly)} this week</span>
        <span>last 30 days</span>
      </div>
    </Card>
  );
}

/** Sticky meta sidebar: install trend, the meta card, links, author, keywords. */
function DetailSidebar({
  detail,
  displayLocales,
  downloadsSeries,
}: Readonly<{ detail: PluginDetail; displayLocales: string[]; downloadsSeries: number[] }>) {
  const hasTrend = downloadsSeries.some((value) => value > 0);
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
      {hasTrend ? (
        <DownloadsCard
          installs={detail.installs ?? 0}
          weekly={detail.downloadsWeekly}
          series={downloadsSeries}
        />
      ) : null}

      <Card className="flex flex-col gap-2.5 p-4 text-sm">
        <MetaRow label="Version" value={detail.version} mono />
        {detail.updatedAt ? <MetaRow label="Updated" value={formatDate(detail.updatedAt)} /> : null}
        {detail.publishedAt ? (
          <MetaRow label="Published" value={formatDate(detail.publishedAt)} />
        ) : null}
        {detail.license ? <MetaRow label="License" value={detail.license} /> : null}
        <MetaRow label="Brika engine" value={detail.brikaEngine} mono />
        {displayLocales.length > 0 ? (
          <MetaRow label="Languages" value={String(displayLocales.length)} mono />
        ) : null}
        {detail.provenance ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Provenance</span>
            <Status variant="success">
              <StatusIndicator pulse={false} />
              <StatusLabel className="font-semibold text-foreground">Signed</StatusLabel>
            </Status>
          </div>
        ) : null}
      </Card>

      <SidebarLinks detail={detail} />
      <SidebarAuthor detail={detail} />
      <SidebarKeywords keywords={detail.keywords} />
    </aside>
  );
}

function PluginDetailPage() {
  const data = Route.useLoaderData();
  const { lang, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab: DetailTab = tab ?? "overview";

  if (data === null) {
    return <NotFoundPage />;
  }

  const onTab = (next: string) => {
    navigate({
      // Keep Overview out of the URL for a clean default; replace so tab clicks
      // don't pile up in history (the back button leaves the page, not steps tabs).
      search: (prev) => ({ ...prev, tab: next === "overview" ? undefined : (next as DetailTab) }),
      replace: true,
    });
  };

  const { detail, readme, versions, readmeLocales } = data;
  const activeLocale = lang ?? (readmeLocales.includes("en") ? "en" : (readmeLocales[0] ?? "en"));
  // Registry plugins show real data: their actual locales, screenshots, and live
  // reviews/comments (empty until written). npm plugins keep the demo placeholders
  // until an npm sync + the D1 social tables land (see docs/store-data-sources.md).
  const isRegistry = isRegistryName(detail.name);
  const displayLocales = isRegistry ? readmeLocales : demoLocales(detail.name, readmeLocales);
  const grantKeys = Object.keys(detail.grants);
  const screenshotCount = isRegistry
    ? detail.screenshots.length
    : detail.screenshots.length > 0
      ? detail.screenshots.length
      : placeholderShotCount(detail.name);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <DetailBreadcrumb
        name={detail.name}
        readmeLocales={readmeLocales}
        activeLocale={activeLocale}
      />

      <DetailHeader detail={detail} displayLocales={displayLocales} />

      <InstallCommand id="install" command={`brika install ${detail.name}`} />

      <Tabs value={activeTab} onValueChange={onTab}>
        <TabsList variant="line">
          {DETAIL_TABS.map(({ id, label }) => (
            <TabsTrigger key={id} value={id}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_290px] lg:items-start">
          {/* main column: the active tab's panel; the sidebar persists across tabs */}
          <div className="flex min-w-0 flex-col gap-7">
            <TabsContent value="overview" className="mt-0 flex flex-col gap-7">
              {screenshotCount > 0 ? (
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold font-heading text-lg tracking-tight">Screenshots</h2>
                    <span className="text-muted-foreground text-xs">{screenshotCount} images</span>
                  </div>
                  <ScreenshotPanels
                    images={detail.screenshots.map((shot) => shot.url)}
                    seed={detail.name}
                    count={screenshotCount}
                  />
                </section>
              ) : null}

              {detail.capabilities ? (
                <section className="flex flex-col gap-3">
                  <h2 className="font-bold font-heading text-lg tracking-tight">Capabilities</h2>
                  <CapabilityChips capabilities={detail.capabilities} />
                </section>
              ) : null}

              <LocalizationSection displayLocales={displayLocales} />

              <PermissionsSection grants={detail.grants} grantKeys={grantKeys} />

              {readme ? (
                <section className="flex flex-col gap-3">
                  <h2 className="font-bold font-heading text-lg tracking-tight">About</h2>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Markdown>{readme}</Markdown>
                  </div>
                </section>
              ) : null}

              {detail.integrity ? (
                <IntegrityProvenanceSection
                  integrity={detail.integrity}
                  provenance={detail.provenance}
                />
              ) : null}

              <DependenciesSection
                dependencies={detail.dependencies}
                peerDependencies={detail.peerDependencies}
                devDependencyCount={detail.devDependencyCount}
                brikaEngine={detail.brikaEngine}
              />
            </TabsContent>

            <TabsContent value="versions" className="mt-0">
              <section className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
                  <Clock className="size-4 text-muted-foreground" />
                  Changelog
                </h2>
                {versions.length > 0 ? (
                  <Changelog versions={versions} />
                ) : (
                  <p className="text-muted-foreground text-sm">No release history yet.</p>
                )}
              </section>
            </TabsContent>

            <TabsContent value="reviews" className="mt-0">
              <ReviewsSection
                pluginName={detail.name}
                fallback={isRegistry ? [] : mockReviews(detail.name)}
              />
            </TabsContent>

            <TabsContent value="discussion" className="mt-0">
              <CommentsSection
                pluginName={detail.name}
                fallback={isRegistry ? [] : mockComments(detail.name)}
              />
            </TabsContent>
          </div>

          <DetailSidebar
            detail={detail}
            displayLocales={displayLocales}
            downloadsSeries={data.downloadsSeries}
          />
        </div>
      </Tabs>
    </main>
  );
}

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

function AddToHubButton({ command }: Readonly<{ command: string }>) {
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
      {copied ? "Copied install" : "Add to hub"}
    </button>
  );
}
