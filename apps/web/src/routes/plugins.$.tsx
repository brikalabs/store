import { Badge } from "@brika/clay/components/badge";
import { Card } from "@brika/clay/components/card";
import { Chart } from "@brika/clay/components/chart";
import { Separator } from "@brika/clay/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@brika/clay/components/tabs";
import type { PluginDetail, PluginFile } from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Box,
  Cable,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Download,
  ExternalLink,
  File as FileIcon,
  Folder,
  FolderOpen,
  Globe,
  KeyRound,
  Layers,
  Link2,
  Lock,
  type LucideIcon,
  Network,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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
import { formatBytes, formatCount, formatDate } from "../lib/format";
import { type GrantFamily, type GrantScope, groupGrants } from "../lib/grants";
import { mockComments, mockReviews } from "../lib/mock-social";
import { getPluginPage } from "../lib/registry";
import { assetUrl, isRegistryName } from "../lib/registry-source";

const DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "permissions", label: "Permissions" },
  { id: "supply-chain", label: "Supply chain" },
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

// Lucide icon per permission family; unknown families fall back to a shield.
const FAMILY_ICONS: Record<string, LucideIcon> = {
  net: Globe,
  netLocal: Network,
  rawSocket: Cable,
  fs: Folder,
  secrets: KeyRound,
  storage: Database,
};

function familyIcon(id: string): LucideIcon {
  return FAMILY_ICONS[id] ?? ShieldCheck;
}

function localeName(code: string): string {
  return LOCALE_NAMES[code] ?? code.toUpperCase();
}

/** An uppercase group label row inside the dependencies card. */
function DepGroupLabel({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="border-border border-b bg-muted px-4 py-2 font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.05em]">
      {children}
    </div>
  );
}

/** One dependency row: name (brand-marked / muted) on the left, range on the right. */
function DepRow({
  name,
  range,
  brand,
  muted,
  hubPeer,
}: Readonly<{ name: string; range: string; brand?: boolean; muted?: boolean; hubPeer?: boolean }>) {
  return (
    <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-2.5">
      <span
        className={`inline-flex min-w-0 items-center gap-2 font-mono text-xs ${muted ? "text-muted-foreground" : "text-brand"}`}
      >
        <Box className="size-3.5 shrink-0 text-muted-foreground/70" />
        <span className="truncate">{name}</span>
        {brand ? <ShieldCheck className="size-3 shrink-0 text-brand" /> : null}
        {hubPeer ? (
          <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 font-medium font-sans text-[10px] text-muted-foreground">
            provided by hub
          </span>
        ) : null}
      </span>
      <span
        className={`shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {range}
      </span>
    </div>
  );
}

/**
 * Dependencies grouped by type, faithful to what the manifest actually declares:
 * runtime + peer + dev with their version ranges (no resolved/installed versions,
 * since the store only has package.json). The `brika` engine surfaces as a peer.
 */
function DependenciesSection({
  dependencies,
  peerDependencies,
  devDependencies,
  brikaEngine,
}: Readonly<{
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  brikaEngine: string;
}>) {
  const deps = Object.entries(dependencies ?? {});
  const peers: [string, string][] = [
    ["brika", brikaEngine],
    ...Object.entries(peerDependencies ?? {}).filter(([name]) => name !== "brika"),
  ];
  const dev = Object.entries(devDependencies ?? {});
  const DEV_CAP = 8;
  const devShown = dev.slice(0, DEV_CAP);
  const devMore = dev.length - devShown.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
          <Layers className="size-4 text-muted-foreground" />
          Dependencies
        </h2>
        <span className="text-muted-foreground text-xs">declared in package.json</span>
      </div>
      <div className="flex items-center gap-4 text-muted-foreground text-xs">
        <span>
          <strong className="text-foreground">{deps.length}</strong> runtime
        </span>
        <span>
          <strong className="text-foreground">{peers.length}</strong> peer
        </span>
        <span>
          <strong className="text-foreground">{dev.length}</strong> dev
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {deps.length > 0 ? (
          <>
            <DepGroupLabel>Dependencies</DepGroupLabel>
            {deps.map(([name, range]) => (
              <DepRow key={name} name={name} range={range} brand={name.startsWith("@brika/")} />
            ))}
          </>
        ) : null}
        <DepGroupLabel>Peer dependencies</DepGroupLabel>
        {peers.map(([name, range]) => (
          <DepRow key={name} name={name} range={range} hubPeer />
        ))}
        {dev.length > 0 ? (
          <>
            <DepGroupLabel>
              Dev dependencies{" "}
              <span className="font-normal text-muted-foreground/60 normal-case">
                · build &amp; test only
              </span>
            </DepGroupLabel>
            {devShown.map(([name, range]) => (
              <DepRow key={name} name={name} range={range} muted />
            ))}
            {devMore > 0 ? (
              <div className="px-4 py-2.5 text-muted-foreground text-xs">
                +{devMore} more dev dependencies
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
        <Box className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
        Version ranges as declared by the author. The exact versions a hub installs are resolved at
        install time, then pinned by the package integrity hash.
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

/** A small "Sensitive" (amber) or "Standard" risk tag on a family card. */
function RiskTag({ risk }: Readonly<{ risk: GrantFamily["risk"] }>) {
  return risk === "sensitive" ? (
    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-semibold text-[10px] text-amber-600 uppercase tracking-[0.04em] dark:text-amber-400">
      Sensitive
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.04em]">
      Standard
    </span>
  );
}

/** Uppercase scope sub-label (Allowed hosts / Read / Write / Operations). */
function ScopeLabel({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.04em]">
      {children}
    </span>
  );
}

/** A mono scope value chip; wildcard hosts render dashed, like the hub does. */
function ScopeChip({ children, dashed }: Readonly<{ children: ReactNode; dashed?: boolean }>) {
  return (
    <span
      className={
        dashed
          ? "inline-flex items-center rounded-md border border-muted-foreground/50 border-dashed px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
          : "inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground"
      }
    >
      {children}
    </span>
  );
}

/** A labelled row of path-pattern chips (the fs Read / Write blocks). */
function PathScope({ label, paths }: Readonly<{ label: string; paths: readonly string[] }>) {
  return (
    <div className="flex flex-col gap-1.5">
      <ScopeLabel>{label}</ScopeLabel>
      <div className="flex flex-wrap gap-1.5">
        {paths.map((path) => (
          <ScopeChip key={path}>{path}</ScopeChip>
        ))}
      </div>
    </div>
  );
}

/** Render a family's requested scope: hosts, ports, paths, ops, or raw items. */
function GrantScopeView({ scope }: Readonly<{ scope: GrantScope }>) {
  if (scope.kind === "hosts") {
    return (
      <div className="flex flex-col gap-1.5">
        <ScopeLabel>Allowed hosts</ScopeLabel>
        <div className="flex flex-wrap gap-1.5">
          {scope.hosts.map((host) => (
            <ScopeChip key={host.value} dashed={host.wildcard}>
              {host.value}
            </ScopeChip>
          ))}
        </div>
      </div>
    );
  }
  if (scope.kind === "ports") {
    return (
      <div className="flex flex-col gap-1.5">
        <ScopeLabel>Loopback ports</ScopeLabel>
        <div className="flex flex-wrap gap-1.5">
          {scope.ports.map((port) => (
            <ScopeChip key={port}>localhost:{port}</ScopeChip>
          ))}
        </div>
      </div>
    );
  }
  if (scope.kind === "paths") {
    return (
      <div className="flex flex-col gap-2.5">
        {scope.read.length > 0 ? <PathScope label="Read" paths={scope.read} /> : null}
        {scope.write.length > 0 ? <PathScope label="Write" paths={scope.write} /> : null}
      </div>
    );
  }
  if (scope.kind === "ops") {
    return (
      <div className="flex flex-col gap-1.5">
        <ScopeLabel>Operations</ScopeLabel>
        <div className="flex flex-wrap gap-1.5">
          {scope.ops.map((op) => (
            <span
              key={op}
              className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-medium text-[11px] text-foreground capitalize"
            >
              {op}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (scope.kind === "raw") {
    return (
      <div className="flex flex-col gap-1.5">
        <ScopeLabel>Scope</ScopeLabel>
        <div className="flex flex-wrap gap-1.5">
          {scope.items.map((item) => (
            <ScopeChip key={item}>{item}</ScopeChip>
          ))}
        </div>
      </div>
    );
  }
  return <span className="text-muted-foreground text-xs">Full family access</span>;
}

/** One permission-family consent card: icon, label, risk, scope, grant ids. */
function GrantFamilyCard({ family }: Readonly<{ family: GrantFamily }>) {
  const Icon = familyIcon(family.id);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{family.label}</span>
            <RiskTag risk={family.risk} />
          </div>
          {family.verbs.length > 0 ? (
            <div className="mt-0.5 text-muted-foreground text-xs">
              Covers {family.verbs.join(" · ")}
            </div>
          ) : null}
        </div>
      </div>
      <GrantScopeView scope={family.scope} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-border border-t pt-2.5 font-mono text-[11px] text-muted-foreground/70">
        {family.grantIds.map((id) => (
          <span key={id}>{id}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * "Permissions requested" section. Grants are grouped by permission family
 * (one family toggle covers all its verbs), with each family's scope made
 * visible and a per-family risk tag. Hidden when the plugin requests nothing.
 */
function PermissionsSection({
  grants,
  grantKeys,
}: Readonly<{ grants: PluginDetail["grants"]; grantKeys: string[] }>) {
  if (grantKeys.length === 0) return null;
  const families = groupGrants(grants);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold font-heading text-lg tracking-tight">Permissions requested</h2>
      <div className="flex flex-col gap-2.5">
        {families.map((family) => (
          <GrantFamilyCard key={family.id} family={family} />
        ))}
      </div>
      <p className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        Consent is granted per family and revocable at any time from your hub. Every grant call is
        recorded in the audit log, with secrets and request bodies redacted.
      </p>
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
        <ProvenanceRow label="Source Commit" href={sha ? `${repoUrl}/commit/${sha}` : repoUrl}>
          github.com/{repository}
          {sha ? `@${sha.slice(0, 7)}` : ""}
        </ProvenanceRow>
        {workflowRef ? (
          <ProvenanceRow
            label="Build File"
            href={
              ref
                ? `${repoUrl}/blob/${ref.replace("refs/heads/", "")}/${workflowPath(workflowRef)}`
                : repoUrl
            }
          >
            {workflowPath(workflowRef)}
          </ProvenanceRow>
        ) : null}
        {provenance.transparencyLog ? (
          <ProvenanceRow label="Public Ledger" href={provenance.transparencyLog.logUrl}>
            Transparency log entry
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
  size,
  unpackedSize,
  fileCount,
}: Readonly<{
  integrity: string;
  provenance: PluginDetail["provenance"];
  size?: number;
  unpackedSize?: number;
  fileCount?: number;
}>) {
  const digestSize = unpackedSize ?? size;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
        <ShieldCheck className="size-4 text-emerald-500" />
        Integrity &amp; provenance
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {provenance
          ? "This package was built and signed in a public CI run. The integrity hash lets your hub verify the download has not been tampered with."
          : "The integrity hash lets your hub verify the download has not been tampered with. A published version is immutable, and bun pins this hash in your lockfile."}
      </p>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="min-w-16 font-semibold text-muted-foreground text-xs">Integrity</span>
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-foreground text-xs">
            {integrity}
          </code>
          <CopyButton value={integrity} />
        </div>
        {digestSize !== undefined ? (
          <>
            <Separator />
            <div className="flex items-center gap-2.5">
              <span className="min-w-16 font-semibold text-muted-foreground text-xs">Digest</span>
              <span className="font-mono text-foreground text-xs">
                tarball · {formatBytes(digestSize)}
                {fileCount !== undefined ? ` · ${fileCount} files` : ""}
              </span>
            </div>
          </>
        ) : null}
      </div>
      <ProvenanceBlock provenance={provenance} />
    </section>
  );
}

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  fileCount: number;
  children: Map<string, FileTreeNode>;
}

interface FileRow {
  path: string;
  depth: number;
  isDir: boolean;
  name: string;
  size: number;
  fileCount: number;
  manifest: boolean;
}

/** Insert one tarball path into the nested directory tree. */
function insertPath(root: Map<string, FileTreeNode>, file: PluginFile): void {
  const parts = file.path.split("/").filter(Boolean);
  let level = root;
  let prefix = "";
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] as string;
    prefix = prefix ? `${prefix}/${part}` : part;
    const isLeaf = i === parts.length - 1;
    const existing = level.get(part);
    const node = existing ?? {
      name: part,
      path: prefix,
      isDir: !isLeaf,
      size: isLeaf ? file.size : 0,
      fileCount: 0,
      children: new Map<string, FileTreeNode>(),
    };
    if (existing === undefined) level.set(part, node);
    if (!isLeaf) level = node.children;
  }
}

/** Fill each directory's leaf-file count in a single pass (so rows are cheap). */
function computeCounts(node: FileTreeNode): number {
  if (!node.isDir) return 1;
  let total = 0;
  for (const child of node.children.values()) total += computeCounts(child);
  node.fileCount = total;
  return total;
}

/** Build the file tree once, with per-directory counts precomputed. */
function buildTree(files: readonly PluginFile[]): Map<string, FileTreeNode> {
  const root = new Map<string, FileTreeNode>();
  for (const file of files) insertPath(root, file);
  for (const node of root.values()) computeCounts(node);
  return root;
}

/** The depth-0 directory paths, opened by default so the structure is visible. */
function topLevelDirs(tree: Map<string, FileTreeNode>): Set<string> {
  const open = new Set<string>();
  for (const node of tree.values()) if (node.isDir) open.add(node.path);
  return open;
}

/**
 * Flatten only the *visible* rows: a collapsed directory contributes its own row
 * but none of its descendants, so the rendered DOM stays small for big trees.
 */
function flattenVisible(
  level: Map<string, FileTreeNode>,
  depth: number,
  open: Set<string>,
  rows: FileRow[],
): void {
  const nodes = [...level.values()];
  const byName = (a: FileTreeNode, b: FileTreeNode) => a.name.localeCompare(b.name);
  for (const dir of nodes.filter((n) => n.isDir).sort(byName)) {
    rows.push({
      path: dir.path,
      depth,
      isDir: true,
      name: dir.name,
      size: 0,
      fileCount: dir.fileCount,
      manifest: false,
    });
    if (open.has(dir.path)) flattenVisible(dir.children, depth + 1, open, rows);
  }
  for (const file of nodes.filter((n) => !n.isDir).sort(byName)) {
    rows.push({
      path: file.path,
      depth,
      isDir: false,
      name: file.name,
      size: file.size,
      fileCount: 0,
      manifest: file.name === "package.json",
    });
  }
}

const IMAGE_EXTS = new Set(["svg", "png", "jpg", "jpeg", "gif", "webp", "avif", "ico"]);
const TEXT_EXTS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "jsonc",
  "md",
  "markdown",
  "txt",
  "css",
  "scss",
  "less",
  "html",
  "htm",
  "yml",
  "yaml",
  "toml",
  "xml",
  "sh",
  "bash",
  "env",
  "map",
  "csv",
]);
const TEXT_NAMES = new Set(["license", "readme", "changelog", ".gitignore", ".npmignore"]);
// Cap inline previews so a large file never streams megabytes into the page.
const MAX_PREVIEW_BYTES = 256 * 1024;

function fileKind(path: string): "image" | "text" | "binary" {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  const base = (path.split("/").pop() ?? "").toLowerCase();
  if (TEXT_EXTS.has(ext) || TEXT_NAMES.has(base)) return "text";
  return "binary";
}

/** The body of a file preview: image, text, or a download fallback. */
function FileContentBody({
  kind,
  previewable,
  src,
  text,
  status,
}: Readonly<{
  kind: "image" | "text" | "binary";
  previewable: boolean;
  src: string;
  text: string | null;
  status: "idle" | "loading" | "error";
}>) {
  if (kind === "image") {
    return (
      <div className="flex justify-center bg-muted/40 p-6">
        <img src={src} alt="" loading="lazy" className="max-h-80 max-w-full object-contain" />
      </div>
    );
  }
  if (kind === "binary" || !previewable) {
    return (
      <div className="px-4 py-6 text-center text-muted-foreground text-sm">
        {kind === "binary" ? "Binary file." : "This file is large."}{" "}
        <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-brand">
          Open raw
        </a>{" "}
        to view it.
      </div>
    );
  }
  if (status === "loading") {
    return <div className="px-4 py-6 text-center text-muted-foreground text-sm">Loading...</div>;
  }
  if (status === "error") {
    return (
      <div className="px-4 py-6 text-center text-muted-foreground text-sm">
        Could not load this file.{" "}
        <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-brand">
          Open raw
        </a>
        .
      </div>
    );
  }
  return (
    <pre className="max-h-96 overflow-auto px-4 py-3 font-mono text-[12px] text-foreground leading-relaxed">
      <code>{text}</code>
    </pre>
  );
}

/**
 * Lazy file preview: fetches the clicked file's bytes from the (immutable,
 * R2-cached) asset endpoint only when opened, capped by size, and renders text
 * inline or an image. Nothing is loaded until the user picks a file.
 */
function FileContentView({
  name,
  version,
  file,
  onClose,
}: Readonly<{ name: string; version: string; file: PluginFile; onClose: () => void }>) {
  const src = assetUrl(name, version, file.path);
  const kind = fileKind(file.path);
  const previewable = file.size <= MAX_PREVIEW_BYTES;
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    if (kind !== "text" || !previewable) return;
    let active = true;
    setStatus("loading");
    setText(null);
    fetch(src)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("load failed"))))
      .then((body) => {
        if (active) {
          setText(body);
          setStatus("idle");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [src, kind, previewable]);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-border border-b bg-muted px-4 py-2">
        <span className="inline-flex min-w-0 items-center gap-2 font-mono text-foreground text-xs">
          <FileIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
          <span className="truncate">{file.path}</span>
          <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand text-xs"
          >
            Raw
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close file preview"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </span>
      </div>
      <FileContentBody
        kind={kind}
        previewable={previewable}
        src={src}
        text={text}
        status={status}
      />
    </div>
  );
}

/** One row in the file tree: a collapsible directory or a selectable file. */
function FileTreeRow({
  row,
  isOpen,
  isSelected,
  onToggle,
  onSelect,
}: Readonly<{
  row: FileRow;
  isOpen: boolean;
  isSelected: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}>) {
  const pad = { paddingLeft: `${16 + row.depth * 20}px` };
  if (row.isDir) {
    return (
      <button
        type="button"
        onClick={() => onToggle(row.path)}
        aria-expanded={isOpen}
        style={pad}
        className="flex w-full items-center justify-between gap-3 border-border border-b px-4 py-2 text-left transition-colors hover:bg-muted/50"
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {isOpen ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/70" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" />
          )}
          {isOpen ? (
            <FolderOpen className="size-3.5 shrink-0 text-brand" />
          ) : (
            <Folder className="size-3.5 shrink-0 text-brand" />
          )}
          <span className="truncate font-mono text-foreground text-xs">{row.name}</span>
        </span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {row.fileCount} files
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(row.path)}
      aria-pressed={isSelected}
      style={pad}
      className={`flex w-full items-center justify-between gap-3 border-border border-b px-4 py-2 text-left transition-colors ${isSelected ? "bg-brand/10" : "hover:bg-muted/50"}`}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="size-3.5 shrink-0" />
        <FileIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="truncate font-mono text-foreground text-xs">{row.name}</span>
        {row.manifest ? (
          <span className="shrink-0 rounded-full border border-brand/40 bg-brand/10 px-1.5 py-0.5 font-medium text-[10px] text-brand-ink">
            manifest
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
        {formatBytes(row.size)}
      </span>
    </button>
  );
}

/**
 * npm-style file explorer for the published tarball: the real file tree (from
 * the bytes the store already unpacks) with collapsible folders and a lazy,
 * size-capped content preview. The tree is built once and only the expanded
 * rows render, so a large package stays cheap.
 */
function FilesSection({
  name,
  version,
  files,
  tarballName,
  tarballUrl,
}: Readonly<{
  name: string;
  version: string;
  files: PluginFile[];
  tarballName: string;
  tarballUrl?: string;
}>) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [open, setOpen] = useState<Set<string>>(() => topLevelDirs(tree));
  const [selected, setSelected] = useState<string | null>(null);
  const toggle = useCallback((path: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);
  const rows = useMemo(() => {
    const out: FileRow[] = [];
    flattenVisible(tree, 0, open, out);
    return out;
  }, [tree, open]);

  if (files.length === 0) return null;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const selectedFile = selected === null ? undefined : files.find((file) => file.path === selected);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
          <Folder className="size-4 text-muted-foreground" />
          Files
        </h2>
        <span className="text-muted-foreground text-xs">
          {files.length} files · {formatBytes(totalSize)} unpacked
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-border border-b bg-muted px-4 py-2 font-mono text-[11.5px] text-muted-foreground">
          <Box className="size-3.5" />
          {tarballName}
        </div>
        {rows.map((row) => (
          <FileTreeRow
            key={row.path}
            row={row}
            isOpen={open.has(row.path)}
            isSelected={selected === row.path}
            onToggle={toggle}
            onSelect={setSelected}
          />
        ))}
        <div className="flex items-center justify-between gap-2 bg-muted px-4 py-2.5 text-muted-foreground text-xs">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            Exactly these files are installed, nothing else runs.
          </span>
          {tarballUrl ? (
            <a
              href={tarballUrl}
              className="shrink-0 font-semibold text-brand"
              target="_blank"
              rel="noreferrer"
            >
              Download tarball
            </a>
          ) : null}
        </div>
      </div>
      {selectedFile ? (
        <FileContentView
          key={selectedFile.path}
          name={name}
          version={version}
          file={selectedFile}
          onClose={() => setSelected(null)}
        />
      ) : null}
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

/** Short "Mon YYYY" label for the chart footer, from an ISO publish date. */
function sinceLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
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

/** Green/red trend pill with a directional arrow, matching the design. */
function TrendPill({ trend }: Readonly<{ trend: number }>) {
  const up = trend >= 0;
  return (
    <span
      className={
        up
          ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600 text-xs dark:text-emerald-400"
          : "inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-600 text-xs dark:text-rose-400"
      }
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {trend}%
    </span>
  );
}

/**
 * Total-downloads card with a real install trend, drawn with the Clay chart kit.
 * Shown only when the registry has install history (npm carries no per-day series).
 */
function DownloadsCard({
  installs,
  weekly,
  series,
  since,
}: Readonly<{ installs: number; weekly: number; series: number[]; since?: string }>) {
  const trend = weekTrend(series);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-muted-foreground text-xs uppercase tracking-[0.04em]">
            Total downloads
          </span>
          <span className="font-bold font-heading text-2xl text-foreground leading-tight">
            {formatCount(installs)}
          </span>
        </div>
        {trend !== 0 ? <TrendPill trend={trend} /> : null}
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
        <span>{since ? `since ${since}` : "last 30 days"}</span>
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
          since={detail.publishedAt ? sinceLabel(detail.publishedAt) : undefined}
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
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="size-4" />
              Signed
            </span>
          </div>
        ) : null}
        {detail.unpackedSize !== undefined || detail.size !== undefined ? (
          <MetaRow
            label="Unpacked size"
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

/**
 * The Overview tab's main column: the readable intro only, so it is no longer a
 * giant scroll. Screenshots, Capabilities, Languages, and About. The heavier
 * reference sections live in the Permissions and Supply chain tabs.
 */
function OverviewPanel({
  detail,
  readme,
  displayLocales,
  isRegistry,
}: Readonly<{
  detail: PluginDetail;
  readme: string | null;
  displayLocales: string[];
  isRegistry: boolean;
}>) {
  const screenshotCount = isRegistry
    ? detail.screenshots.length
    : detail.screenshots.length > 0
      ? detail.screenshots.length
      : placeholderShotCount(detail.name);
  return (
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

      {readme ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-heading text-lg tracking-tight">About</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Markdown>{readme}</Markdown>
          </div>
        </section>
      ) : null}
    </TabsContent>
  );
}

/** The Permissions tab: the grant-families section on its own. */
function PermissionsPanel({
  detail,
  grantKeys,
}: Readonly<{ detail: PluginDetail; grantKeys: string[] }>) {
  return (
    <TabsContent value="permissions" className="mt-0 flex flex-col gap-7">
      {grantKeys.length > 0 ? (
        <PermissionsSection grants={detail.grants} grantKeys={grantKeys} />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold font-heading text-lg tracking-tight">Permissions requested</h2>
          <p className="text-muted-foreground text-sm">
            This plugin requests no permissions. It runs fully sandboxed, with no network, secret,
            or filesystem access.
          </p>
        </section>
      )}
    </TabsContent>
  );
}

/** The Supply chain tab: integrity &amp; provenance, dependencies, and files together. */
function SupplyChainPanel({ detail }: Readonly<{ detail: PluginDetail }>) {
  const tarballName = `${detail.name.split("/").pop() ?? detail.name}-${detail.version}.tgz`;
  return (
    <TabsContent value="supply-chain" className="mt-0 flex flex-col gap-7">
      {detail.integrity ? (
        <IntegrityProvenanceSection
          integrity={detail.integrity}
          provenance={detail.provenance}
          size={detail.size}
          unpackedSize={detail.unpackedSize}
          fileCount={detail.fileCount}
        />
      ) : null}

      <DependenciesSection
        dependencies={detail.dependencies}
        peerDependencies={detail.peerDependencies}
        devDependencies={detail.devDependencies}
        brikaEngine={detail.brikaEngine}
      />

      <FilesSection
        name={detail.name}
        version={detail.version}
        files={detail.files ?? []}
        tarballName={tarballName}
        tarballUrl={detail.tarballUrl}
      />
    </TabsContent>
  );
}

/**
 * Live review/comment counts for the tab badges. Mirrors the sections' rule: the
 * D1 count when non-empty, else the demo fallback (npm placeholders). Fetched
 * client-side so the badges are independent of which tab is mounted.
 */
function useSocialCounts(name: string | undefined): { reviews: number; comments: number } {
  const fallbackReviews = name && !isRegistryName(name) ? mockReviews(name).length : 0;
  const fallbackComments = name && !isRegistryName(name) ? mockComments(name).length : 0;
  const [apiReviews, setApiReviews] = useState<number | null>(null);
  const [apiComments, setApiComments] = useState<number | null>(null);
  useEffect(() => {
    if (name === undefined) return;
    const enc = encodeURIComponent(name);
    const grab = (path: string, set: (n: number) => void) =>
      fetch(`/v1/plugins/${enc}/${path}`)
        .then((res) => res.json())
        .then((json: unknown) => {
          if (Array.isArray(json)) set(json.length);
        })
        .catch(() => undefined);
    grab("reviews", setApiReviews);
    grab("comments", setApiComments);
  }, [name]);
  return {
    reviews: apiReviews && apiReviews > 0 ? apiReviews : fallbackReviews,
    comments: apiComments && apiComments > 0 ? apiComments : fallbackComments,
  };
}

function PluginDetailPage() {
  const data = Route.useLoaderData();
  const { lang, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const activeTab: DetailTab = tab ?? "overview";
  const counts = useSocialCounts(data?.detail.name);

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
  const tabCounts: Partial<Record<DetailTab, number>> = {
    reviews: counts.reviews,
    discussion: counts.comments,
  };

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
          {DETAIL_TABS.map(({ id, label }) => {
            const count = tabCounts[id];
            return (
              <TabsTrigger key={id} value={id}>
                {label}
                {count ? (
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground/70">
                    {formatCount(count)}
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_290px] lg:items-start">
          {/* main column: the active tab's panel; the sidebar persists across tabs */}
          <div className="flex min-w-0 flex-col gap-7">
            <OverviewPanel
              detail={detail}
              readme={readme}
              displayLocales={displayLocales}
              isRegistry={isRegistry}
            />

            <PermissionsPanel detail={detail} grantKeys={grantKeys} />

            <SupplyChainPanel detail={detail} />

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
