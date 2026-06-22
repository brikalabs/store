import { cn } from "@brika/clay";
import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { type ThemeMode, useTheme } from "@/hooks/use-theme";

const MODES: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Light / dark / system theme toggle: a three-segment control with the active mode highlighted. */
export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
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
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
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
