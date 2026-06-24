import { Button, Input, Textarea } from "@brika/clay";
import { Link2, X } from "lucide-react";
import type { SyntheticEvent } from "react";
import { LinkIcon } from "@/components/clay/link-icon";
import { SettingsCard } from "@/components/clay/settings-card";
import type { EditLink, ProfileLink } from "@/hooks/use-links";
import { useScopeProfile } from "@/hooks/use-scope-profile";
import type { ScopeCardProps } from "@/lib/scope-api";

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
  const { description, setDescription, links, addLink, updateLink, removeLink, saved, busy, save } =
    useScopeProfile(scope, onError);

  function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  let saveLabel = "Save profile";
  if (busy) saveLabel = "Saving…";
  else if (saved) saveLabel = "Saved";

  return (
    <SettingsCard className="gap-3">
      <form onSubmit={onSubmit} className="contents">
        <h2 className="font-bold text-base text-foreground">Profile</h2>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
              onChange={(patch) => updateLink(link.id, patch)}
              onRemove={() => removeLink(link.id)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addLink}
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
