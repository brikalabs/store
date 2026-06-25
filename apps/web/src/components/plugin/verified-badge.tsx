import { BadgeCheck } from "lucide-react";
import { useT } from "@/i18n";

/**
 * The blue "verified organization" check (Twitter-style): a scope that has cryptographically proven
 * it controls a domain (ORG-010). Distinct from the orange "approved by Brika" plugin shield.
 */
export function VerifiedBadge({ className }: Readonly<{ className?: string }>) {
  const t = useT();
  return (
    <BadgeCheck
      aria-label={t("plugin:verifiedOrg")}
      className={`shrink-0 fill-sky-500 text-white ${className ?? "size-4"}`}
    />
  );
}
