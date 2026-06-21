import { Button, Input, Textarea } from "@brika/clay";
import { type UserProfile, UserProfile as UserProfileSchema } from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ExternalLink, Plus, X } from "lucide-react";
import { type SyntheticEvent, useEffect, useState } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { AdminShell } from "@/components/layout/admin-shell";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/account/profile")
      .then((res) => res.json())
      .then((json: unknown) => {
        const parsed = UserProfileSchema.safeParse(json);
        if (active && parsed.success) setProfile(parsed.data);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell login={user.login} activeLabel="Profile">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-bold font-heading text-2xl tracking-tight">Profile</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            How you appear on your public account page.
          </p>
        </div>
        <Link
          to="/u/$id"
          params={{ id: user.id }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted"
        >
          <ExternalLink className="size-4 text-muted-foreground" />
          View public profile
        </Link>
      </div>
      {profile === null ? (
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      ) : (
        <ProfileEditor
          profile={profile}
          onSaved={setProfile}
          avatarUrl={user.avatarUrl ?? undefined}
        />
      )}
    </AdminShell>
  );
}

function ProfileEditor({
  profile,
  onSaved,
  avatarUrl,
}: Readonly<{
  profile: UserProfile;
  onSaved: (next: UserProfile) => void;
  avatarUrl?: string;
}>) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  // Rows carry a stable client id so React keys (and edits) are identity-based,
  // not positional. The id is transient - it is stripped before the row is saved.
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

      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={profile.displayName ?? profile.id}
            className="size-16 rounded-[18px] border border-border object-cover"
          />
        ) : (
          <GradientAvatar
            seed={profile.id}
            label={profile.displayName ?? profile.id}
            size={64}
            className="rounded-[18px]"
          />
        )}
        <span className="text-muted-foreground text-xs">
          Your avatar comes from your GitHub account.
        </span>
      </div>

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
