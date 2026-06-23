import type { PluginListingStatus } from "@brika/registry-contract";
import { Pill, type PillTone } from "@/components/clay/pill";

/** Per-status dot-pill: live states read positive (success/warning), hidden ones read as danger. */
const STATUS_BADGE: Record<PluginListingStatus, { label: string; tone: PillTone }> = {
  published: { label: "Published", tone: "success" },
  deprecated: { label: "Deprecated", tone: "warning" },
  yanked: { label: "Yanked", tone: "danger" },
  taken_down: { label: "Taken down", tone: "danger" },
  reserved: { label: "Reserved", tone: "muted" },
};

export function StatusBadge({ status }: Readonly<{ status: PluginListingStatus }>) {
  const { label, tone } = STATUS_BADGE[status];
  return (
    <Pill tone={tone} dot border>
      {label}
    </Pill>
  );
}
