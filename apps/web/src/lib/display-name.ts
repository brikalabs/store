/**
 * The one rule for the human label shown for an account, used wherever a store projects a
 * user into a contract shape (reviews, comments, profiles): the account's user-set profile
 * name, else its stored name, else a neutral fallback. NEVER the opaque account id or the
 * GitHub username - the product has no user-facing username. Pure, so it lives in `lib`.
 */

/**
 * Last-resort label when an account has no stored name at all. Should never be reached: every
 * write path stores `name ?? login`, so this only guards a corrupt/legacy row.
 */
export const FALLBACK_DISPLAY_NAME = "Anonymous";

/** Resolve the display name from a profile override and the stored account name. */
export function displayNameOf(profileDisplayName: string | null, name: string | null): string {
  return profileDisplayName ?? name ?? FALLBACK_DISPLAY_NAME;
}
