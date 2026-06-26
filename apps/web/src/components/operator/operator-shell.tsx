import {
  Box as BoxIcon,
  Flag,
  Layers,
  type LucideIcon,
  ScrollText,
  ShieldAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { type AppKey, useT } from "@/i18n";

type NavItem = { key: string; labelKey: AppKey; icon: LucideIcon; href: string };

const NAV: NavItem[] = [
  { key: "scopes", labelKey: "operator:navScopes", icon: Layers, href: "/operator/scopes" },
  { key: "plugins", labelKey: "operator:navPlugins", icon: BoxIcon, href: "/operator/plugins" },
  { key: "reports", labelKey: "operator:navReports", icon: Flag, href: "/operator/reports" },
  { key: "audit", labelKey: "operator:navAudit", icon: ScrollText, href: "/operator/audit" },
];

/** Chrome for the operator console: a sticky-sidebar layout marked as a privileged moderation surface. */
export function OperatorShell({
  activeLabel,
  children,
}: Readonly<{ activeLabel: string; children: ReactNode }>) {
  const t = useT();
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[208px_1fr] lg:items-start">
        <aside className="flex flex-col gap-1 lg:sticky lg:top-20">
          <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-amber-500/10 px-3 py-2.5">
            <ShieldAlert className="size-5 text-amber-600" />
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground text-sm">
                {t("operator:shellTitle")}
              </div>
              <div className="text-muted-foreground text-xs">{t("operator:shellSubtitle")}</div>
            </div>
          </div>
          {NAV.map((item) => {
            const active = item.key === activeLabel;
            return (
              <a
                key={item.key}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sm transition-colors ${
                  active
                    ? "bg-brand/10 text-brand-ink"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon
                  className={active ? "size-4 text-brand-ink" : "size-4 text-muted-foreground"}
                />
                {t(item.labelKey)}
              </a>
            );
          })}
        </aside>
        <div className="flex flex-col gap-8">{children}</div>
      </div>
    </main>
  );
}
