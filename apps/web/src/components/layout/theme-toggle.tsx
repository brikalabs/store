import { cn } from "@brika/clay";
import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { type ThemeMode, useTheme } from "@/hooks/use-theme";
import { type AppKey, useT } from "@/i18n";

const ICON: Record<ThemeMode, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };
const LABEL_KEY: Record<ThemeMode, AppKey> = {
  light: "layout:themeLight",
  dark: "layout:themeDark",
  system: "layout:themeSystem",
};
// Clicking cycles to the next state: light -> dark -> system -> light.
const NEXT: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "system", system: "light" };

/** A single tri-state toggle that cycles light -> dark -> system, showing the current mode's icon. */
export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const t = useT();
  const { mode, setMode } = useTheme();
  const Icon = ICON[mode];
  const label = t(LABEL_KEY[mode]);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setMode(NEXT[mode])}
      className={cn(
        "inline-flex size-[38px] items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
