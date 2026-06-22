/**
 * The one rule for an account's human label: profile name, else stored name, else a neutral
 * fallback. NEVER the opaque account id or the GitHub username - the product has no user-facing username.
 */

// Should never be reached: every write path stores `name ?? login`; only guards a corrupt/legacy row.
const FALLBACK_DISPLAY_NAME = "Anonymous";

/** Resolve the display name from a profile override and the stored account name. */
export function displayNameOf(profileDisplayName: string | null, name: string | null): string {
  return profileDisplayName ?? name ?? FALLBACK_DISPLAY_NAME;
}
