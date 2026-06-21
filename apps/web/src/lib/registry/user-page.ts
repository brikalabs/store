import type { PluginSummary, Review, UserProfile } from "@brika/registry-contract";

/**
 * The public account profile page view model (USER-002): the account's profile, the plugins it
 * owns (by scope membership), and the reviews it authored. A pure read-model type, imported by both
 * the client view and the server resolver (`server/services/user-page.ts`).
 */
export interface UserPage {
  readonly profile: UserProfile;
  readonly plugins: PluginSummary[];
  readonly reviews: Review[];
}
