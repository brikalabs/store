import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@brika/clay";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/i18n";
import { TakedownDialog } from "./takedown-dialog";

/** The amber "Privileged · registry moderation" banner plus the screen's title and description. */
export function OperatorHeader({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  const t = useT();
  return (
    <header className="flex flex-col gap-3">
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-semibold text-amber-600 text-xs dark:text-amber-400">
        <ShieldAlert className="size-3.5" />
        {t("operator:privilegedBadge")}
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="font-bold font-heading text-2xl tracking-tight">{title}</h1>
        <p className="max-w-2xl text-muted-foreground text-sm">{children}</p>
      </div>
    </header>
  );
}

export interface Facet<K extends string> {
  key: K;
  label: string;
  count: number;
}

/** Filter chips with counts; the active facet is brand-tinted. */
export function FacetChips<K extends string>({
  facets,
  active,
  onSelect,
}: Readonly<{ facets: Facet<K>[]; active: K; onSelect: (key: K) => void }>) {
  return (
    <div className="flex flex-wrap gap-2">
      {facets.map((facet) => {
        const on = facet.key === active;
        return (
          <button
            key={facet.key}
            type="button"
            onClick={() => onSelect(facet.key)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-medium text-xs transition-colors ${
              on
                ? "border-brand/40 bg-brand/10 text-brand-ink"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {facet.label}
            <span className="font-mono text-[11px] opacity-70">{facet.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A small labeled Clay select (defaults to a "Sort" label; reused for other single-choice filters). */
export function SortSelect<K extends string>({
  value,
  options,
  onChange,
  label,
}: Readonly<{
  value: K;
  options: { value: K; label: string }[];
  onChange: (key: K) => void;
  label?: string;
}>) {
  const t = useT();
  const resolvedLabel = label ?? t("operator:sortLabel");
  return (
    <div className="inline-flex items-center gap-2 text-muted-foreground text-xs">
      <span>{resolvedLabel}</span>
      <Select
        value={value}
        onValueChange={(next) => {
          const match = options.find((option) => option.value === next);
          if (match) onChange(match.value);
        }}
      >
        <SelectTrigger
          aria-label={resolvedLabel}
          size="sm"
          className="w-auto gap-1.5 font-medium text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The selection action bar shown when one or more rows are selected: "Take down selected" opens the
 * reason modal (recorded in the audit log), keeping a bulk takedown from being a single click.
 */
export function BulkBar({
  count,
  noun,
  busy,
  onTakedown,
  onClear,
}: Readonly<{
  count: number;
  noun: string;
  busy: boolean;
  onTakedown: (reason: string) => void;
  onClear: () => void;
}>) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3">
      <span className="font-semibold text-brand-ink text-sm">
        {t("operator:bulkSelected", { count, noun })}
      </span>
      <div className="min-w-3 flex-1" />
      <TakedownDialog
        trigger={
          <Button variant="destructive" disabled={busy}>
            {t("operator:takeDownSelected")}
          </Button>
        }
        title={t("operator:takeDownSelected")}
        description={t("operator:bulkSelected", { count, noun })}
        confirmLabel={t("operator:takeDownSelected")}
        busy={busy}
        onConfirm={onTakedown}
      />
      <Button variant="ghost" disabled={busy} onClick={onClear}>
        {t("operator:clear")}
      </Button>
    </div>
  );
}
