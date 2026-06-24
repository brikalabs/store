import { type UserProfile, UserProfile as UserProfileSchema } from "@brika/registry-contract";
import { useState } from "react";
import type { ProfileLink } from "@/hooks/use-links";

/** The editable fields the profile-save endpoint accepts (the avatar is persisted on upload). */
export interface ProfileDraft {
  displayName: string;
  bio: string;
  website: string;
  links: readonly ProfileLink[];
}

/**
 * The save side of the account profile editor: PUT the trimmed draft to `/api/account/profile`,
 * parse the returned record, and report it through `onSaved` so the page swaps in the saved profile.
 * Tracks `saving` for the button and `saved` for the confirmation tick. `save` resolves to the
 * persisted profile (so the form can re-seed its link rows) or `null` when the request/parse failed.
 */
export function useProfileSave(onSaved: (next: UserProfile) => void) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(draft: ProfileDraft): Promise<UserProfile | null> {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: draft.displayName.trim() || undefined,
        bio: draft.bio.trim() || undefined,
        website: draft.website.trim() || undefined,
        links: draft.links,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const parsed = UserProfileSchema.safeParse(await res.json());
      if (parsed.success) {
        onSaved(parsed.data);
        setSaved(true);
        return parsed.data;
      }
    }
    return null;
  }

  return { saving, saved, save };
}
