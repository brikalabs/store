import { Ban } from "lucide-react";
import { useT } from "@/i18n";

/**
 * The notice an owner sees on their dashboard when an operator has taken down their scope or plugin:
 * it is withdrawn from the public store, and this is why. Distinct from {@link ErrorBanner} (a
 * transient action error) - this is a standing moderation state, so it leads with the reason. Renders
 * nothing when there is no takedown, so callers can drop the guard.
 */
export function TakedownBanner({
  reason,
  subject,
}: Readonly<{ reason: string | null; subject: "scope" | "plugin" }>) {
  const t = useT();
  if (reason === null) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[11px] border border-danger-border bg-danger-tint px-4 py-3 text-danger text-sm"
    >
      <Ban className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-bold">
          {subject === "scope"
            ? t("dashboard:takedownScopeTitle")
            : t("dashboard:takedownPluginTitle")}
        </p>
        <p className="mt-1 text-danger/90">{t("dashboard:takedownReason", { reason })}</p>
      </div>
    </div>
  );
}
