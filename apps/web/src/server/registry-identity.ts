import type { PublishIdentity } from "@brika/registry-core";
import type { SessionUser } from "@/lib/auth";

/**
 * Map the web session user to the registry's publish identity. The store signs users in
 * with GitHub, so the session login is the GitHub `owner`; `repository` is null because a
 * console action is a local (non-CI) actor, exactly like a `brika publish` from a laptop.
 * This is what authorizes the reused `ScopeService`/`ManagementService` calls.
 */
export function sessionIdentity(user: SessionUser): PublishIdentity {
  return { provider: "github", owner: user.login, repository: null };
}
