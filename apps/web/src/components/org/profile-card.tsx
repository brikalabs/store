import { Button, Input } from "@brika/clay";
import { Link2, Trash2 } from "lucide-react";
import { type SyntheticEvent, useEffect, useState } from "react";
import { type OrgCardProps, orgPath, readError } from "../../lib/org-api";
import { LinkIcon } from "../clay/link-icon";

interface ProfileLink {
  label: string;
  url: string;
}

/** A link with a stable client-side id, so React keys survive add/remove/reorder. */
interface EditLink extends ProfileLink {
  id: string;
}

let linkSeq = 0;
function newEditLink(link: ProfileLink = { label: "", url: "" }): EditLink {
  linkSeq += 1;
  return { id: `link-${linkSeq}`, ...link };
}

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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
        <LinkIcon url={link.url} className="size-4" />
      </span>
      <Input
        value={link.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Label (e.g. X, LinkedIn, npm)"
        aria-label={`Link ${index + 1} label`}
        className="sm:max-w-[180px]"
      />
      <Input
        value={link.url}
        onChange={(e) => onChange({ url: e.target.value })}
        placeholder="https://…"
        aria-label={`Link ${index + 1} URL`}
        className="flex-1 font-mono"
      />
      <button
        type="button"
        aria-label={`Remove link ${index + 1}`}
        onClick={onRemove}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

/** Edit the org's description + arbitrary labelled links (hydrated from the public record). */
export function ProfileCard({ org, onError }: Readonly<OrgCardProps>) {
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<EditLink[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(orgPath(org)).catch(() => null);
      if (!res?.ok) return;
      const data: { description?: string | null; links?: ProfileLink[] } = await res.json();
      setDescription(data.description ?? "");
      setLinks((data.links ?? []).map((l) => newEditLink(l)));
    })();
  }, [org]);

  function updateLink(id: string, patch: Partial<ProfileLink>) {
    setLinks((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setSaved(false);
  }
  function removeLink(id: string) {
    setLinks((current) => current.filter((l) => l.id !== id));
    setSaved(false);
  }
  function addLink() {
    setLinks((current) => [...current, newEditLink()]);
  }

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    const cleaned = links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.label.length > 0 && l.url.length > 0);
    const trimmed = description.trim();
    const res = await fetch(orgPath(org, "/profile"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: trimmed.length === 0 ? null : trimmed, links: cleaned }),
    });
    setBusy(false);
    if (res.ok) {
      setLinks(cleaned.map((l) => newEditLink(l)));
      setSaved(true);
    } else {
      onError(await readError(res));
    }
  }

  let saveLabel = "Save profile";
  if (busy) saveLabel = "Saving…";
  else if (saved) saveLabel = "Saved";

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="font-bold font-heading text-lg tracking-tight">Profile</h2>
      <textarea
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          setSaved(false);
        }}
        placeholder="What does this organisation build?"
        aria-label="Org description"
        rows={3}
        maxLength={500}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex flex-col gap-2">
        <span className="font-medium text-muted-foreground text-sm">Links</span>
        {links.map((link, index) => (
          <LinkRow
            key={link.id}
            link={link}
            index={index}
            onChange={(patch) => updateLink(link.id, patch)}
            onRemove={() => removeLink(link.id)}
          />
        ))}
        <button
          type="button"
          onClick={addLink}
          className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-border border-dashed px-3 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          <Link2 className="size-4" />
          Add link
        </button>
      </div>
      <Button type="submit" disabled={busy} className="w-fit">
        {saveLabel}
      </Button>
    </form>
  );
}
