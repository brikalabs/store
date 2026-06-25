import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@brika/clay";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useLocalePref } from "@/hooks/use-locale-pref";
import { useT } from "@/i18n";
import { type Locale, SUPPORTED_LOCALES } from "@/i18n/catalog";

/** The language's name in its own language, capitalized: `fr` -> "Français". */
function nativeName(code: Locale): string {
  const name = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** The language's name in English: `fr` -> "French". */
function englishName(code: Locale): string {
  return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
}

/**
 * Language picker: a globe + locale-code pill that opens the supported locales (native name over its
 * English name, the active one checked). The choice persists via cookie and re-renders in place.
 */
export function LocaleToggle() {
  const t = useT();
  const { locale, setLocale } = useLocalePref();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("nav:language")}
        className="group inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-border bg-card px-2.5 text-muted-foreground outline-none transition-colors hover:text-foreground"
      >
        <Globe className="size-4" />
        <span className="font-semibold text-foreground text-sm">
          {(locale.split("-")[0] ?? locale).toUpperCase()}
        </span>
        <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-64 rounded-2xl p-1.5">
        <div className="px-2.5 py-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
          {t("nav:language")}
        </div>
        {SUPPORTED_LOCALES.map((code) => {
          const active = code === locale;
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => setLocale(code)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-xl px-2.5 py-2",
                active && "bg-muted",
              )}
            >
              <span className="flex w-full items-center justify-between font-semibold text-foreground text-sm">
                {nativeName(code)}
                {active ? <Check className="size-4 text-brand-ink" /> : null}
              </span>
              <span className="text-muted-foreground text-xs">{englishName(code)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
