import { Button, Input } from "@brika/clay";
import { Tag } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { SettingsCard } from "@/components/clay/settings-card";
import { useScopeDisplayName } from "@/hooks/use-scope-display-name";
import { useT } from "@/i18n";
import type { ScopeCardProps } from "@/lib/scope-api";

/** Set the scope's display name shown on its packages (overrides the manifest author). */
export function DisplayNameCard({
  scope,
  current,
  onError,
}: Readonly<ScopeCardProps & { current: string | null }>) {
  const t = useT();
  const { busy, save } = useScopeDisplayName(scope, onError);
  const [value, setValue] = useState(current ?? "");
  const [saved, setSaved] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    if (await save(value)) setSaved(true);
  }

  let saveLabel = t("scope:save");
  if (busy) saveLabel = t("scope:saving");
  else if (saved) saveLabel = t("scope:saved");

  // How the attribution renders on a package: the typed name, or the scope when cleared.
  const preview = value.trim() || scope;

  return (
    <SettingsCard className="gap-0">
      <form onSubmit={submit} className="contents">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-ink">
            <Tag className="size-[18px]" />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="font-bold text-base text-foreground">{t("scope:displayNameTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("scope:displayNameDescription")}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
            placeholder={t("scope:displayNamePlaceholder")}
            aria-label={t("scope:displayNameAriaLabel")}
            className="flex-1 rounded-[11px] border-input bg-muted"
          />
          <Button
            type="submit"
            disabled={busy}
            className="h-[42px] rounded-[11px] bg-brand px-5 font-bold text-brand-foreground hover:brightness-105"
          >
            {saveLabel}
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-2.5 rounded-[11px] border border-border bg-muted/40 px-3 py-2.5">
          <span className="shrink-0 text-muted-foreground text-xs uppercase tracking-wide">
            {t("scope:displayNamePreview")}
          </span>
          <GradientAvatar
            seed={scope}
            label={preview}
            imageUrl={`/api/scopes/${encodeURIComponent(scope)}/icon`}
            size={22}
            className="rounded-md"
          />
          <span className="truncate font-medium text-foreground text-sm">{preview}</span>
        </div>
      </form>
    </SettingsCard>
  );
}
