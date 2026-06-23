import { Button, Input, Textarea } from "@brika/clay";
import { Link2, X } from "lucide-react";
import { type SyntheticEvent, useEffect, useState } from "react";
import { LinkIcon } from "@/components/clay/link-icon";
import { SettingsCard } from "@/components/clay/settings-card";
import { cleanLinks, type EditLink, type ProfileLink, useLinks } from "@/hooks/use-links";
import { readError, type ScopeCardProps, scopePath } from "@/lib/scope-api";

/** One editable link row (icon preview + label + URL + remove). */
function LinkRow({
  link,
  index,
  onChange,
  onRemove,
}: Readonly<{
  link: EditLink;
  index: number;
  onChange: (patch: Partial<ProfileLink>) => void;
  onRemove: () => void;
}>) {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] border border-input bg-muted text-muted-foreground">
        <LinkIcon url={link.url} className="size-4" />
      </span>
      <Input
        value={link.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Label (e.g. X, LinkedIn, npm)"
        aria-label={`Link ${index + 1} label`}
        className="rounded-[11px] border-input bg-muted sm:max-w-[180px]"
      />
      <Input
        value={link.url}
        onChange={(e) => onChange({ url: e.target.value })}
        placeholder="https://…"
        aria-label={`Link ${index + 1} URL`}
        className="flex-1 rounded-[11px] border-input bg-muted font-mono"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Remove link ${index + 1}`}
        onClick={onRemove}
        className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] border border-input bg-card text-muted-foreground hover:border-danger-border hover:bg-card hover:text-danger"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

/** Edit the scope's description + arbitrary labelled links (hydrated from the public record). */
export function ProfileCard({ scope, onError }: Readonly<ScopeCardProps>) {
  const [description, setDescription] = useState("");
  const { links, add, update, remove, reset } = useLinks();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(scopePath(scope)).catch(() => null);
      if (!res?.ok) return;
      const data: { description?: string | null; links?: ProfileLink[] } = await res.json();
      setDescription(data.description ?? "");
      reset(data.links ?? []);
    })();
  }, [scope, reset]);

  function editLink(id: string, patch: Partial<ProfileLink>) {
    update(id, patch);
    setSaved(false);
  }
  function dropLink(id: string) {
    remove(id);
    setSaved(false);
  }

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    const cleaned = cleanLinks(links);
    const trimmed = description.trim();
    const res = await fetch(scopePath(scope, "/profile"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: trimmed.length === 0 ? null : trimmed, links: cleaned }),
    });
    setBusy(false);
    if (res.ok) {
      reset(cleaned);
      setSaved(true);
    } else {
      onError(await readError(res));
    }
  }

  let saveLabel = "Save profile";
  if (busy) saveLabel = "Saving…";
  else if (saved) saveLabel = "Saved";

  return (
    <SettingsCard className="gap-3">
      <form onSubmit={save} className="contents">
        <h2 className="font-bold text-base text-foreground">Profile</h2>
        <Textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
          placeholder="What does this scope build?"
          aria-label="Scope description"
          rows={3}
          maxLength={500}
          className="rounded-[11px] border-input bg-muted"
        />
        <div className="flex flex-col gap-2.5">
          <span className="font-semibold text-muted-foreground text-sm">Links</span>
          {links.map((link, index) => (
            <LinkRow
              key={link.id}
              link={link}
              index={index}
              onChange={(patch) => editLink(link.id, patch)}
              onRemove={() => dropLink(link.id)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={add}
            className="inline-flex h-[38px] w-fit items-center gap-2 rounded-[10px] border border-input border-dashed px-3.5 font-semibold text-muted-foreground text-sm shadow-none hover:border-brand-border hover:bg-transparent hover:text-foreground"
          >
            <Link2 className="size-4" />
            Add link
          </Button>
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="h-[42px] w-fit rounded-[11px] bg-brand px-5 font-bold text-brand-foreground hover:brightness-105"
        >
          {saveLabel}
        </Button>
      </form>
    </SettingsCard>
  );
}
