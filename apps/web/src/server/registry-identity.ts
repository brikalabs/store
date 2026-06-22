import type { PublishIdentity } from "@brika/registry-core";
import type { SessionUser } from "@/lib/auth/auth";

/**
 * Map the web session user to the registry's publish identity. A console action is a human, local
 * actor keyed on the Brika account id; `provider`/`repository` are null (those are the CI/OIDC path).
 */
export function sessionIdentity(user: SessionUser): PublishIdentity {
  return { userId: user.id, provider: null, repository: null };
}
