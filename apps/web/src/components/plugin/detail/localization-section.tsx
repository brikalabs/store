import { Globe } from "lucide-react";
import { useT } from "@/i18n";
import { localeName } from "./helpers";

/** "Localization" section listing the languages a plugin ships; hidden when none. */
export function LocalizationSection({ displayLocales }: Readonly<{ displayLocales: string[] }>) {
  const t = useT();
  if (displayLocales.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
        <Globe className="size-4 text-muted-foreground" />
        {t("pluginDetail:localizationHeading")}
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("pluginDetail:shipsTranslations", { count: displayLocales.length })}
      </p>
      <div className="flex flex-wrap gap-2">
        {displayLocales.map((loc) => (
          <span
            key={loc}
            className="rounded-[9px] border border-border bg-card px-3 py-1.5 font-medium text-foreground text-sm"
          >
            {localeName(loc)}
            {loc === "en" ? (
              <span className="ml-1.5 font-semibold text-[10px] text-muted-foreground">
                {t("pluginDetail:localeDefault")}
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </section>
  );
}
