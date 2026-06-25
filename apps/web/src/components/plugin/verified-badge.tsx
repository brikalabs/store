import { CircleCheck } from "lucide-react";
import { useT } from "@/i18n";

/**
 * The "verified organization" badge: a scope an operator has vetted. Brand-filled check, distinct
 * from the orange "approved by Brika" plugin shield (different shape + a solid fill).
 */
export function VerifiedBadge({ className }: Readonly<{ className?: string }>) {
  const t = useT();
  return (
    <CircleCheck
      aria-label={t("plugin:verifiedOrg")}
      className={`shrink-0 fill-brand text-brand-foreground ${className ?? "size-4"}`}
    />
  );
}
