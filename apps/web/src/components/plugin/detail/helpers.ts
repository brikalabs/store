import {
  Cable,
  Database,
  Folder,
  Globe,
  KeyRound,
  type LucideIcon,
  Network,
  ShieldCheck,
} from "lucide-react";

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

export function familyIcon(id: string): LucideIcon {
  return FAMILY_ICONS[id] ?? ShieldCheck;
}

export function localeName(code: string): string {
  return LOCALE_NAMES[code] ?? code.toUpperCase();
}

/** The repo path from a GitHub OIDC `workflow_ref` (`owner/repo/<path>@ref`). */
export function workflowPath(workflowRef: string): string {
  const beforeRef = workflowRef.split("@")[0] ?? workflowRef;
  const parts = beforeRef.split("/");
  return parts.length > 2 ? parts.slice(2).join("/") : beforeRef;
}

/** Running total of a per-day series, as the `{ts, value}` points the Chart plots. */
export function cumulativePoints(series: number[]): { ts: number; value: number }[] {
  let sum = 0;
  return series.map((value, index) => {
    sum += value;
    return { ts: index, value: sum };
  });
}

/** Short "Mon YYYY" label for the chart footer, from an ISO publish date. */
export function sinceLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

/** Week-over-week install trend (%): last 7 days vs the prior 7. */
export function weekTrend(series: number[]): number {
  const n = series.length;
  const sum = (from: number, to: number) =>
    series.slice(Math.max(0, from), Math.max(0, to)).reduce((a, b) => a + b, 0);
  const recent = sum(n - 7, n);
  const prior = sum(n - 14, n - 7);
  if (prior === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - prior) / prior) * 100);
}
