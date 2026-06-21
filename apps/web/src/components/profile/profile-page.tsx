import { type UserProfile, UserProfile as UserProfileSchema } from "@brika/registry-contract";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { ProfileEditor } from "./profile-editor";

const route = getRouteApi("/dashboard/profile");

export function ProfilePage() {
  const { user } = route.useRouteContext();
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
    <AdminShell id={user.id} name={user.name} avatarUrl={user.avatarUrl} activeLabel="Profile">
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
