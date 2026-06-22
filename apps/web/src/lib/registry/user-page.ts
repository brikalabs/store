import type { PluginSummary, Review, UserProfile } from "@brika/registry-contract";

/** The public account profile page view model (USER-002): profile, owned plugins, authored reviews. */
export interface UserPage {
  readonly profile: UserProfile;
  readonly plugins: PluginSummary[];
  readonly reviews: Review[];
}
