import { Button, Input, Textarea } from "@brika/clay";
import {
  type DeveloperProfile,
  DeveloperProfile as DeveloperProfileSchema,
} from "@brika/registry-contract";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ExternalLink } from "lucide-react";
import { type SyntheticEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { GithubIcon } from "@/components/clay/icons";
import { GradientAvatar } from "@/components/clay/plugin-icon";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<DeveloperProfile | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/account/profile")
      .then((res) => res.json())
      .then((json: unknown) => {
        const parsed = DeveloperProfileSchema.safeParse(json);
        if (active && parsed.success) setProfile(parsed.data);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell login={user.login} activeLabel="Profile">
      <div>
        <h1 className="font-bold font-heading text-2xl tracking-tight">Profile</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          How you appear on your public developer page.
        </p>
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
  profile: DeveloperProfile;
  onSaved: (next: DeveloperProfile) => void;
  avatarUrl?: string;
}>) {
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
        website: website.trim() || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const parsed = DeveloperProfileSchema.safeParse(await res.json());
      if (parsed.success) {
        onSaved(parsed.data);
        setSaved(true);
      }
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold font-heading text-xl tracking-tight">Public profile</h2>
        <Link
          to="/developers/$id"
          params={{ id: profile.id }}
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          View public profile
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={profile.id}
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
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-mono text-muted-foreground text-sm">
            <GithubIcon className="size-4" />@{profile.id}
            <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px]">
              from npm
            </span>
          </div>
          <span className="text-muted-foreground text-xs">
            Identity is derived from your npm account.
          </span>
        </div>
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
