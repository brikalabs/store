import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@brika/clay";
import { Check, Globe } from "lucide-react";
import { useLocalePref } from "@/hooks/use-locale-pref";
import { type Locale, SUPPORTED_LOCALES } from "@/i18n/catalog";

/** A locale's name in its own language, capitalized: `en` -> "English", `fr` -> "Français". */
function languageName(code: Locale): string {
  const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
  if (name === undefined) return code;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Language picker: a globe button opening the supported locales; the choice persists via cookie. */
export function LocaleToggle() {
  const { locale, setLocale } = useLocalePref();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Language"
        title="Language"
        className="inline-flex size-[38px] items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground outline-none transition-colors hover:text-foreground"
      >
        <Globe className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-44 rounded-xl p-1.5">
        {SUPPORTED_LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => setLocale(code)}
            className="justify-between gap-2.5 rounded-lg px-2.5 py-2 font-medium text-[13.5px]"
          >
            {languageName(code)}
            {code === locale ? <Check className="size-4 text-brand-ink" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
