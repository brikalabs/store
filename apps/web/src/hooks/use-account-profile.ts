import { type UserProfile, UserProfile as UserProfileSchema } from "@brika/registry-contract";
import { useEffect, useState } from "react";

/**
 * The signed-in account's public profile for the dashboard profile page: load it once from
 * `/api/account/profile`, keeping the page presentational. `null` while loading; `setProfile` lets
 * the editor swap in the saved record after a successful PUT (the editor owns its own save call).
 */
export function useAccountProfile() {
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

  return { profile, setProfile };
}
