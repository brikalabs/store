import { Globe } from "lucide-react";
import { localeName } from "./helpers";

/** "Localization" section listing the languages a plugin ships; hidden when none. */
export function LocalizationSection({ displayLocales }: Readonly<{ displayLocales: string[] }>) {
  if (displayLocales.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-bold font-heading text-lg tracking-tight">
        <Globe className="size-4 text-muted-foreground" />
        Localization
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Ships translations for <strong className="text-foreground">{displayLocales.length}</strong>{" "}
        {displayLocales.length === 1 ? "language" : "languages"}. Brika picks the active locale from
        the hub at runtime, falling back to English.
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
                DEFAULT
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </section>
  );
}
