import type { LucideIcon } from "lucide-react";
import { useT } from "@/i18n";

/**
 * The operator's "verified" pill toggle, shared by the plugin and scope console rows. The icon is the
 * caller's (a shield for plugins, a check for scopes); everything else - the on/off styling, the
 * label, the disabled-while-busy behavior - is the same trust affordance.
 */
export function VerifyToggle({
  verified,
  busy,
  icon: Icon,
  onToggle,
}: Readonly<{
  verified: boolean;
  busy: boolean;
  icon: LucideIcon;
  onToggle: (verified: boolean) => void;
}>) {
  const t = useT();
  const label = verified ? t("operator:verified") : t("operator:verify");
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onToggle(!verified)}
      title={label}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold text-xs transition-colors disabled:opacity-50 ${
        verified
          ? "bg-brand/10 text-brand-ink hover:bg-brand/20"
          : "border border-border text-muted-foreground hover:border-brand/40 hover:text-foreground"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
