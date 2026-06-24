import { Box, KeyRound, Layers, LayoutGrid, Link2, type LucideIcon, User } from "lucide-react";
import type { ReactNode } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { type AppKey, useT } from "@/i18n";

// `label` is the stable English identifier callers pass as `activeLabel`; `labelKey` is the
// locale-resolved display text. Keeping both lets matching stay locale-independent.
type NavItem = { label: string; labelKey: AppKey; icon: LucideIcon; href: string };

const NAV: NavItem[] = [
  { label: "Overview", labelKey: "layout:navOverview", icon: LayoutGrid, href: "/dashboard" },
  { label: "My plugins", labelKey: "layout:navMyPlugins", icon: Box, href: "/dashboard/plugins" },
  { label: "Scopes", labelKey: "layout:navScopes", icon: Layers, href: "/dashboard/scopes" },
  { label: "Profile", labelKey: "layout:navProfile", icon: User, href: "/dashboard/profile" },
  {
    label: "Connected accounts",
    labelKey: "layout:navConnectedAccounts",
    icon: Link2,
    href: "/dashboard/accounts",
  },
  {
    label: "API tokens",
    labelKey: "layout:navApiTokens",
    icon: KeyRound,
    href: "/dashboard/account/tokens",
  },
];

/** Signed-in developer dashboard chrome: a sticky sidebar nav + main column. */
export function AdminShell({
  id,
  name,
  avatarUrl,
  activeLabel,
  children,
}: Readonly<{
  id: string;
  name: string | null;
  avatarUrl?: string | null;
  activeLabel: string;
  children: ReactNode;
}>) {
  const t = useT();
  const displayName = name ?? t("layout:accountFallback");
  return (
    <main className="mx-auto grid max-w-7xl items-start gap-[34px] px-6 pt-[30px] pb-24 lg:grid-cols-[236px_1fr]">
      <aside className="flex flex-col gap-0.5 lg:sticky lg:top-[92px]">
        <div className="flex items-center gap-2.5 px-2.5 pt-2 pb-4">
          <GradientAvatar
            seed={id}
            label={displayName}
            imageUrl={avatarUrl}
            size={38}
            className="rounded-xl border border-border"
          />
          <div className="min-w-0">
            <div className="truncate font-bold text-foreground text-sm">{displayName}</div>
            <div className="text-muted-foreground text-xs">{t("layout:developer")}</div>
          </div>
        </div>
        {NAV.map((item) => {
          const active = item.label === activeLabel;
          return (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 font-semibold text-[13.5px] transition-colors ${
                active
                  ? "bg-brand-tint text-brand-ink"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className="size-[18px]" />
              {t(item.labelKey)}
            </a>
          );
        })}
      </aside>
      <div className="flex min-w-0 flex-col gap-[26px]">{children}</div>
    </main>
  );
}
