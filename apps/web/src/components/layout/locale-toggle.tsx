import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@brika/clay";
import { CIMODE } from "@brika/i18n";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useLocalePref } from "@/hooks/use-locale-pref";
import { useT } from "@/i18n";
import { defaultLocale, locales } from "@/i18n/catalog";

/** The language's name in its own language, capitalized: `fr` -> "Français". */
function nativeName(code: string): string {
  const name = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** The language's name in `inLocale`, following that locale's casing: `ja` in fr -> "japonais". */
function localizedName(code: string, inLocale: string): string {
  // Intl.DisplayNames throws on a non-BCP-47 tag like "cimode"; fall back to a real locale.
  const display = locales.includes(inLocale) ? inLocale : defaultLocale;
  return new Intl.DisplayNames([display], { type: "language" }).of(code) ?? code;
}

/**
 * Language picker: a globe + locale-code pill that opens the supported locales (native name over its
 * name in the current UI language, the active one checked). The choice persists via cookie. In dev it
 * also offers `cimode`, which shows the raw message keys for inspection.
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
        {locales.map((code) => {
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
              <span className="text-muted-foreground text-xs">{localizedName(code, locale)}</span>
            </DropdownMenuItem>
          );
        })}
        {import.meta.env.DEV ? (
          <DropdownMenuItem
            onSelect={() => setLocale(CIMODE)}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-xl px-2.5 py-2",
              locale === CIMODE && "bg-muted",
            )}
          >
            <span className="flex w-full items-center justify-between font-semibold text-foreground text-sm">
              Keys
              {locale === CIMODE ? <Check className="size-4 text-brand-ink" /> : null}
            </span>
            <span className="text-muted-foreground text-xs">cimode (dev only)</span>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
