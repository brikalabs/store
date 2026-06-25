import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@brika/clay";
import type { PluginSummary, SearchDirection } from "@brika/registry-contract";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  Clock,
  Download,
  type LucideIcon,
  Sparkles,
} from "lucide-react";
import { type AppKey, useT } from "@/i18n";

export type SortKey = "relevance" | "downloads" | "recent" | "name";

/** Each field's natural direction: the toggle starts here, and picking a field resets to it. */
const NATURAL: Record<SortKey, SearchDirection> = {
  relevance: "desc",
  downloads: "desc",
  recent: "desc",
  name: "asc",
};

const OPTIONS: { value: SortKey; labelKey: AppKey; icon: LucideIcon }[] = [
  { value: "relevance", labelKey: "plugin:sortRelevance", icon: Sparkles },
  { value: "downloads", labelKey: "plugin:sortDownloads", icon: Download },
  { value: "recent", labelKey: "plugin:sortRecent", icon: Clock },
  { value: "name", labelKey: "plugin:sortName", icon: ArrowDownAZ },
];

/** The first sort term (field + effective direction) of a `field:dir,…` URL string, for the menu. */
export function primarySort(sort: string | undefined): {
  field: SortKey;
  direction: SearchDirection;
} {
  const first = (sort ?? "").split(",")[0] ?? "";
  const [name, dir] = first.split(":").map((part) => part.trim());
  const field = OPTIONS.find((option) => option.value === name)?.value ?? "relevance";
  return { field, direction: dir === "asc" || dir === "desc" ? dir : NATURAL[field] };
}

/** Sort a plugin list by a field + direction (relevance keeps the source order). */
export function sortPlugins(
  plugins: PluginSummary[],
  field: SortKey,
  direction: SearchDirection = NATURAL[field],
): PluginSummary[] {
  const downloads = (p: PluginSummary) => p.installs ?? p.downloadsWeekly;
  const list = [...plugins];
  switch (field) {
    case "downloads":
      list.sort((a, b) => downloads(b) - downloads(a));
      break;
    case "recent":
      list.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      break;
    case "name":
      list.sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name));
      break;
    // relevance: keep the source order
  }
  // Each case sorts in its natural direction; flip for the opposite.
  return direction === NATURAL[field] ? list : list.reverse();
}

/** A "Sort: <label>" dropdown plus an asc/desc toggle (hidden for relevance, which is best-first). */
export function SortMenu({
  field,
  direction,
  onChange,
  className,
}: Readonly<{
  field: SortKey;
  direction: SearchDirection;
  onChange: (field: SortKey, direction: SearchDirection) => void;
  className?: string;
}>) {
  const t = useT();
  const current = OPTIONS.find((option) => option.value === field);
  return (
    <div className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm outline-none transition-colors hover:border-brand/40">
          {current ? <current.icon className="size-4 text-brand-ink" /> : null}
          <span className="font-semibold text-foreground">
            {current ? t(current.labelKey) : ""}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onChange(option.value, NATURAL[option.value])}
              className="gap-2"
            >
              <option.icon className="size-4 text-muted-foreground" />
              {t(option.labelKey)}
              {option.value === field ? <Check className="ml-auto size-4 text-brand-ink" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {field !== "relevance" ? (
        <button
          type="button"
          aria-label={t("plugin:sort")}
          onClick={() => onChange(field, direction === "asc" ? "desc" : "asc")}
          className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-card text-brand-ink outline-none transition-colors hover:border-brand/40"
        >
          {direction === "asc" ? (
            <ArrowUpNarrowWide className="size-4" />
          ) : (
            <ArrowDownWideNarrow className="size-4" />
          )}
        </button>
      ) : null}
    </div>
  );
}
