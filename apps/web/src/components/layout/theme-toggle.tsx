import { cn } from "@brika/clay";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

/** Sun/moon control that flips the whole app between light and dark. */
export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun className="size-4 text-brand-ink" />
      ) : (
        <Moon className="size-4 text-brand-ink" />
      )}
    </button>
  );
}
