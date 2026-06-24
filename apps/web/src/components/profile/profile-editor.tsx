import { Button, Card, Input, Textarea } from "@brika/clay";
import type { UserProfile } from "@brika/registry-contract";
import { Check, Plus, X } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { LinkIcon } from "@/components/clay/link-icon";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { cleanLinks, type EditLink, type ProfileLink, useLinks } from "@/hooks/use-links";
import { useProfileSave } from "@/hooks/use-profile-save";

/** One editable link row: an icon hint, an inline label + URL pair, and a remove button. */
function ProfileLinkRow({
  link,
  onUpdate,
  onRemove,
}: Readonly<{
  link: EditLink;
  onUpdate: (patch: Partial<ProfileLink>) => void;
  onRemove: () => void;
}>) {
  return (
    <div className="flex h-11 items-stretch overflow-hidden rounded-xl border border-input bg-muted transition focus-within:border-brand-border focus-within:bg-card focus-within:ring-2 focus-within:ring-brand-tint">
      <span
        title={link.url}
        className="flex w-[46px] shrink-0 items-center justify-center border-border border-r text-muted-foreground"
      >
        <LinkIcon url={link.url} />
      </span>
      <Input
        placeholder="Label"
        value={link.label}
        onChange={(event) => onUpdate({ label: event.target.value })}
        className="h-full w-32 shrink-0 rounded-none border-none bg-transparent px-3 font-semibold text-[13.5px] shadow-none focus-visible:ring-0"
      />
      <span className="w-px shrink-0 bg-border" />
      <Input
        type="url"
        placeholder="https://"
        value={link.url}
        onChange={(event) => onUpdate({ url: event.target.value })}
        className="h-full min-w-0 flex-1 rounded-none border-none bg-transparent px-3 font-mono text-[13px] text-muted-foreground shadow-none focus-visible:ring-0"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Remove link"
        onClick={onRemove}
        className="flex h-full w-11 shrink-0 items-center justify-center rounded-none border-border border-l text-muted-foreground transition hover:bg-danger-tint hover:text-danger"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

export function ProfileEditor({
  profile,
  onSaved,
}: Readonly<{
  profile: UserProfile;
  onSaved: (next: UserProfile) => void;
}>) {
  // Seed from the RESOLVED avatar (uploaded ?? provider), not the session image, so a reload
  // reflects an uploaded avatar instead of reverting to the provider one.
  const [avatar, setAvatar] = useState(profile.avatarUrl);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  // Rows carry a stable client id so React keys (and edits) are identity-based, not positional.
  const { links, add, update, remove, reset } = useLinks(profile.links);
  const { saving, saved, save } = useProfileSave(onSaved);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = await save({ displayName, bio, website, links: cleanLinks(links) });
    if (next) reset(next.links);
  }

  return (
    <Card className="flex flex-col gap-5 rounded-[20px] border border-border bg-card p-[26px] shadow-sm">
      <h2 className="font-bold font-heading text-[18px] text-foreground tracking-tight">
        Public profile
      </h2>

      <AvatarPicker
        id={profile.id}
        displayName={profile.displayName}
        avatarUrl={avatar}
        onChange={setAvatar}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label htmlFor="profile-name" className="flex flex-col gap-1.5">
            <span className="font-semibold text-[13px] text-foreground">Display name</span>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="h-11 rounded-[11px] border-input bg-muted"
            />
          </label>
          <label htmlFor="profile-website" className="flex flex-col gap-1.5">
            <span className="font-semibold text-[13px] text-foreground">Website</span>
            <Input
              id="profile-website"
              type="url"
              placeholder="https://"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="h-11 rounded-[11px] border-input bg-muted"
            />
          </label>
        </div>

        <label htmlFor="profile-bio" className="flex flex-col gap-1.5">
          <span className="font-semibold text-[13px] text-foreground">Bio</span>
          <Textarea
            id="profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={3}
            className="rounded-[11px] border-input bg-muted"
          />
        </label>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-[13px] text-foreground">Links</span>
            <span className="text-[12px] text-muted-foreground">
              {links.length} of 8 - shown on your public profile
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {links.map((link) => (
              <ProfileLinkRow
                key={link.id}
                link={link}
                onUpdate={(patch) => update(link.id, patch)}
                onRemove={() => remove(link.id)}
              />
            ))}
          </div>
          {links.length < 8 ? (
            <Button
              type="button"
              variant="outline"
              onClick={add}
              className="inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-input border-dashed font-semibold text-muted-foreground text-sm transition hover:border-brand-border hover:bg-brand-tint hover:text-brand-ink"
            >
              <Plus className="size-4" />
              Add link
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center rounded-xl bg-brand px-5 font-bold text-brand-foreground text-sm hover:brightness-105"
          >
            {saving ? "Saving…" : "Save profile"}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
              <Check className="size-4 text-brand-ink" />
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
