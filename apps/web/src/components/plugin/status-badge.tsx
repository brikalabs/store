import type { PluginListingStatus } from "@brika/registry-contract";
import { Pill, type PillTone } from "@/components/clay/pill";
import { type AppKey, useT } from "@/i18n";

/** Per-status dot-pill: live states read positive (success/warning), hidden ones read as danger. */
const STATUS_BADGE: Record<PluginListingStatus, { labelKey: AppKey; tone: PillTone }> = {
  published: { labelKey: "plugin:statusPublished", tone: "success" },
  deprecated: { labelKey: "plugin:statusDeprecated", tone: "warning" },
  yanked: { labelKey: "plugin:statusYanked", tone: "danger" },
  taken_down: { labelKey: "plugin:statusTakenDown", tone: "danger" },
  reserved: { labelKey: "plugin:statusReserved", tone: "muted" },
};

export function StatusBadge({ status }: Readonly<{ status: PluginListingStatus }>) {
  const t = useT();
  const { labelKey, tone } = STATUS_BADGE[status];
  return (
    <Pill tone={tone} dot border>
      {t(labelKey)}
    </Pill>
  );
}
