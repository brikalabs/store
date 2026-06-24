import { cn } from "@brika/clay";
import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { type ThemeMode, useTheme } from "@/hooks/use-theme";
import { type AppKey, useT } from "@/i18n";

const MODES: { value: ThemeMode; labelKey: AppKey; icon: LucideIcon }[] = [
  { value: "light", labelKey: "layout:themeLight", icon: Sun },
  { value: "dark", labelKey: "layout:themeDark", icon: Moon },
  { value: "system", labelKey: "layout:themeSystem", icon: Monitor },
];

/** Light / dark / system theme toggle: a three-segment control with the active mode highlighted. */
export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const t = useT();
  const { mode, setMode } = useTheme();
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5",
        className,
      )}
    >
      {MODES.map((option) => {
        const active = option.value === mode;
        const label = t(option.labelKey);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => setMode(option.value)}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-background text-brand-ink shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <option.icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
