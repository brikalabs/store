import { Button, Input, Textarea } from "@brika/clay";
import { type UserProfile, UserProfile as UserProfileSchema } from "@brika/registry-contract";
import { Check, Plus, X } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { AvatarPicker } from "@/components/profile/avatar-picker";

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
  // Rows carry a stable client id so React keys are identity-based, not positional;
  // the id is stripped before save.
  const [links, setLinks] = useState<{ id: string; label: string; url: string }[]>(() =>
    profile.links.map((link) => ({ ...link, id: crypto.randomUUID() })),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setLink(id: string, patch: Partial<{ label: string; url: string }>) {
    setLinks((prev) => prev.map((link) => (link.id === id ? { ...link, ...patch } : link)));
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((link) => link.id !== id));
  }

  function addLink() {
    setLinks((prev) => [...prev, { id: crypto.randomUUID(), label: "", url: "" }]);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    // Only keep links with both a label and a url; the API rejects partial rows.
    const cleanLinks = links
      .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
      .filter((link) => link.label.length > 0 && link.url.length > 0);
    const res = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
        website: website.trim() || undefined,
        links: cleanLinks,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const parsed = UserProfileSchema.safeParse(await res.json());
      if (parsed.success) {
        onSaved(parsed.data);
        setLinks(parsed.data.links.map((link) => ({ ...link, id: crypto.randomUUID() })));
        setSaved(true);
      }
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-bold font-heading text-xl tracking-tight">Public profile</h2>

      <AvatarPicker
        id={profile.id}
        displayName={profile.displayName}
        avatarUrl={avatar}
        onChange={setAvatar}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label htmlFor="profile-name" className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">Display name</span>
          <Input
            id="profile-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label htmlFor="profile-bio" className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">Bio</span>
          <Textarea
            id="profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={3}
          />
        </label>
        <label htmlFor="profile-website" className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-foreground">Website</span>
          <Input
            id="profile-website"
            type="url"
            placeholder="https://"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>

        <div className="flex flex-col gap-2 text-sm">
          <span className="font-semibold text-foreground">Links</span>
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-2">
              <Input
                placeholder="Label"
                value={link.label}
                onChange={(event) => setLink(link.id, { label: event.target.value })}
                className="w-1/3"
              />
              <Input
                type="url"
                placeholder="https://"
                value={link.url}
                onChange={(event) => setLink(link.id, { url: event.target.value })}
                className="flex-1"
              />
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => removeLink(link.id)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          {links.length < 8 ? (
            <button
              type="button"
              onClick={addLink}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border border-dashed px-3 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted"
            >
              <Plus className="size-4" />
              Add link
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
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
    </div>
  );
}
