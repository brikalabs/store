import { Button, Input } from "@brika/clay";
import { Link2, Trash2 } from "lucide-react";
import { type SyntheticEvent, useEffect, useState } from "react";
import { type OrgCardProps, orgPath, readError } from "../../lib/org-api";
import { LinkIcon } from "../clay/link-icon";

interface ProfileLink {
  label: string;
  url: string;
}

/** Edit the org's description + arbitrary labelled links (hydrated from the public record). */
export function ProfileCard({ org, onError }: Readonly<OrgCardProps>) {
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(orgPath(org)).catch(() => null);
      if (res?.ok) {
        const data = (await res.json()) as { description?: string | null; links?: ProfileLink[] };
        setDescription(data.description ?? "");
        setLinks(data.links ?? []);
      }
    })();
  }, [org]);

  function updateLink(index: number, patch: Partial<ProfileLink>) {
    setLinks((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    setSaved(false);
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
      setLinks(cleaned);
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
          // biome-ignore lint/suspicious/noArrayIndexKey: order-stable editable rows
          <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
              <LinkIcon url={link.url} className="size-4" />
            </span>
            <Input
              value={link.label}
              onChange={(e) => updateLink(index, { label: e.target.value })}
              placeholder="Label (e.g. X, LinkedIn, npm)"
              aria-label={`Link ${index + 1} label`}
              className="sm:max-w-[180px]"
            />
            <Input
              value={link.url}
              onChange={(e) => updateLink(index, { url: e.target.value })}
              placeholder="https://…"
              aria-label={`Link ${index + 1} URL`}
              className="flex-1 font-mono"
            />
            <button
              type="button"
              aria-label={`Remove link ${index + 1}`}
              onClick={() => {
                setLinks((c) => c.filter((_, i) => i !== index));
                setSaved(false);
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLinks((c) => [...c, { label: "", url: "" }])}
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
