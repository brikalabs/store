import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@brika/clay";
import type { PluginSummary } from "@brika/registry-contract";
import {
  ArrowDownAZ,
  Check,
  ChevronDown,
  Clock,
  Download,
  type LucideIcon,
  Sparkles,
  Star,
} from "lucide-react";
import { type AppKey, useT } from "@/i18n";

export type SortKey = "relevance" | "downloads" | "rating" | "recent" | "name";

const OPTIONS: { value: SortKey; labelKey: AppKey; icon: LucideIcon }[] = [
  { value: "relevance", labelKey: "plugin:sortRelevance", icon: Sparkles },
  { value: "downloads", labelKey: "plugin:sortDownloads", icon: Download },
  { value: "rating", labelKey: "plugin:sortRating", icon: Star },
  { value: "recent", labelKey: "plugin:sortRecent", icon: Clock },
  { value: "name", labelKey: "plugin:sortName", icon: ArrowDownAZ },
];

/** Sort a plugin list by the chosen key (relevance keeps the source order). */
export function sortPlugins(plugins: PluginSummary[], sort: SortKey): PluginSummary[] {
  const list = [...plugins];
  switch (sort) {
    case "downloads":
      return list.sort((a, b) => b.downloadsWeekly - a.downloadsWeekly);
    case "rating":
      return list.sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
    case "recent":
      return list.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    case "name":
      return list.sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name));
    default:
      return list;
  }
}

/** A working "Sort: <label>" dropdown. */
export function SortMenu({
  value,
  onChange,
  className,
}: Readonly<{ value: SortKey; onChange: (next: SortKey) => void; className?: string }>) {
  const t = useT();
  const current = OPTIONS.find((option) => option.value === value) ?? OPTIONS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm outline-none transition-colors hover:border-brand/40 ${className ?? ""}`}
      >
        <span className="text-muted-foreground">{t("plugin:sort")}</span>
        <span className="font-semibold text-foreground">{current ? t(current.labelKey) : ""}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onChange(option.value)}
            className="gap-2"
          >
            <option.icon className="size-4 text-muted-foreground" />
            {t(option.labelKey)}
            {option.value === value ? <Check className="ml-auto size-4 text-brand-ink" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
