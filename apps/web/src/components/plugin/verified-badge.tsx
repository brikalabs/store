import { BadgeCheck } from "lucide-react";
import { useT } from "@/i18n";

/**
 * The "verified organization" badge: a scope an operator has vetted. A solid brand-filled scalloped
 * seal, distinct in shape from the "approved by Brika" plugin shield.
 */
export function VerifiedBadge({ className }: Readonly<{ className?: string }>) {
  const t = useT();
  return (
    <BadgeCheck
      aria-label={t("plugin:verifiedOrg")}
      className={`shrink-0 fill-brand text-brand-foreground ${className ?? "size-4"}`}
    />
  );
}
