import { Button } from "@brika/clay";
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-bold font-heading text-[30px] text-foreground tracking-tight">
            Profile
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            How you appear on your public account page.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-input bg-card px-3.5 font-semibold text-foreground text-sm transition-colors hover:border-brand-border"
        >
          <Link to="/u/$id" params={{ id: user.id }}>
            <ExternalLink className="size-4 text-muted-foreground" />
            View public profile
          </Link>
        </Button>
      </div>
      {profile === null ? (
        <div className="h-72 animate-pulse rounded-[20px] bg-muted" />
      ) : (
        <ProfileEditor profile={profile} onSaved={setProfile} />
      )}
    </AdminShell>
  );
}
