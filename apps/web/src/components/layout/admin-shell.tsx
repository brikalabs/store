import { Box, KeyRound, Layers, LayoutDashboard, Link2, type LucideIcon, User } from "lucide-react";
import type { ReactNode } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";

type NavItem = { label: string; icon: LucideIcon; href?: string };

const NAV: NavItem[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "My plugins", icon: Box, href: "/dashboard/plugins" },
  { label: "Scopes", icon: Layers, href: "/dashboard/scopes" },
  { label: "Profile", icon: User, href: "/dashboard/profile" },
  { label: "Connected accounts", icon: Link2, href: "/dashboard/accounts" },
  { label: "API tokens", icon: KeyRound, href: "/dashboard/account/tokens" },
];

/** Signed-in developer dashboard chrome: a sticky sidebar nav + main column. */
export function AdminShell({
  login,
  activeLabel,
  children,
}: Readonly<{ login: string; activeLabel: string; children: ReactNode }>) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[208px_1fr] lg:items-start">
        <aside className="flex flex-col gap-1 lg:sticky lg:top-20">
          <div className="flex items-center gap-2.5 px-2 pb-3">
            <GradientAvatar seed={login} label={login} size={32} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground text-sm">{login}</div>
              <div className="text-muted-foreground text-xs">Developer</div>
            </div>
          </div>
          {NAV.map((item) => {
            const active = item.label === activeLabel;
            const base =
              "flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sm transition-colors";
            const content = (
              <>
                <item.icon
                  className={active ? "size-4 text-brand-ink" : "size-4 text-muted-foreground"}
                />
                {item.label}
              </>
            );
            if (item.href) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={`${base} ${
                    active
                      ? "bg-brand/10 text-brand-ink"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {content}
                </a>
              );
            }
            return (
              <span
                key={item.label}
                className={`${base} cursor-not-allowed text-muted-foreground/60`}
              >
                {content}
              </span>
            );
          })}
        </aside>
        <div className="flex flex-col gap-8">{children}</div>
      </div>
    </main>
  );
}
