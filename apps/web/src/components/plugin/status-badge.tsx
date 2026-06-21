import type { PluginListingStatus } from "@brika/registry-contract";

/** Per-status pill: live states read positive (emerald/amber), hidden ones read as a warning. */
const STATUS_BADGE: Record<PluginListingStatus, { label: string; className: string }> = {
  published: {
    label: "Published",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  deprecated: {
    label: "Deprecated",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  yanked: { label: "Yanked", className: "bg-destructive/15 text-destructive" },
  taken_down: { label: "Taken down", className: "bg-destructive/15 text-destructive" },
};

export function StatusBadge({ status }: Readonly<{ status: PluginListingStatus }>) {
  const { label, className } = STATUS_BADGE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-xs ${className}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      <span>{label}</span>
    </span>
  );
}
