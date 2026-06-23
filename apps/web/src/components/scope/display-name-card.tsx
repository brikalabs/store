import { Button, Input } from "@brika/clay";
import { ShieldCheck } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { SettingsCard } from "@/components/clay/settings-card";
import { readError, type ScopeCardProps, scopePath } from "@/lib/scope-api";

/** Set the scope's verified-publisher display name (overrides the manifest author). */
export function DisplayNameCard({ scope, onError }: Readonly<ScopeCardProps>) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    const trimmed = value.trim();
    const res = await fetch(scopePath(scope, "/display-name"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: trimmed.length === 0 ? null : trimmed }),
    });
    setBusy(false);
    if (res.ok) setSaved(true);
    else onError(await readError(res));
  }

  let saveLabel = "Save";
  if (busy) saveLabel = "Saving…";
  else if (saved) saveLabel = "Saved";

  return (
    <SettingsCard className="gap-1.5">
      <form onSubmit={submit} className="contents">
        <h2 className="flex items-center gap-2 font-bold text-base text-foreground">
          <ShieldCheck className="size-[18px] text-brand-ink" />
          Verified publisher name
        </h2>
        <p className="text-muted-foreground text-sm">
          The trusted name shown on every package this scope publishes, overriding the manifest
          author. Leave blank to clear it.
        </p>
        <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Acme Inc"
            aria-label="Verified publisher display name"
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
      </form>
    </SettingsCard>
  );
}
