import type { PublishIdentity } from "@brika/registry-core";
import type { SessionUser } from "@/lib/auth/auth";

/**
 * Map the web session user to the registry's publish identity. A console action is a human,
 * local (non-CI) actor identified by the Brika account id, exactly like a `brika publish` from a
 * laptop: `userId` is the account, `provider`/`repository` are null (those are the CI/OIDC path).
 * This is what authorizes the reused `ScopeService`/`ManagementService` calls.
 */
export function sessionIdentity(user: SessionUser): PublishIdentity {
  return { userId: user.id, provider: null, repository: null };
}
