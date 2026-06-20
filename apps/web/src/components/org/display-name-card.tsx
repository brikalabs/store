import { Button, Input } from "@brika/clay";
import { ShieldCheck } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { type OrgCardProps, orgPath, readError } from "../../lib/org-api";

/** Set the org's verified-publisher display name (overrides the manifest author). */
export function DisplayNameCard({ org, onError }: Readonly<OrgCardProps>) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    const trimmed = value.trim();
    const res = await fetch(orgPath(org, "/display-name"), {
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
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-brand-ink" />
        <h2 className="font-bold font-heading text-lg tracking-tight">Verified publisher name</h2>
      </div>
      <p className="text-muted-foreground text-sm">
        The trusted name shown on every package this organisation publishes, overriding the manifest
        author. Leave blank to clear it.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Acme Inc"
          aria-label="Verified publisher display name"
        />
        <Button type="submit" disabled={busy}>
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}
