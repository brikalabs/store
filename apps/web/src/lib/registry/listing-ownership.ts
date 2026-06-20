import { scopeOf } from "@brika/registry-core";
import { listScopesForMember } from "@brika/store-db/adapters";
import type { SessionUser } from "@/lib/auth/auth";
import { isListingMaintainer } from "@/lib/registry/listing";
import { personName } from "@/lib/registry/manifest-mapping";
import { getPackument } from "@/lib/registry/npm";
import { registryDb } from "@/server/registry-services";

/**
 * May this user edit the store listing for `name`? Resolves the inputs (scope membership
 * from the shared registry D1, or npm maintainers from the packument) and applies
 * {@link isListingMaintainer}. Real checks, never trusting the client.
 *
 * SERVER-ONLY: reaches the shared registry D1 (`registryDb`) and npm.
 */
export async function canEditPluginListing(user: SessionUser, name: string): Promise<boolean> {
  const scope = scopeOf(name);
  if (scope !== null) {
    const scopes = await listScopesForMember(registryDb(), "github", user.login);
    return isListingMaintainer({
      scope,
      memberScopes: scopes.map((s) => s.scope),
      maintainers: [],
      login: user.login,
    });
  }
  const pkg = await getPackument(name);
  const maintainers = (pkg?.maintainers ?? [])
    .map((m) => personName(m))
    .filter((m): m is string => m !== undefined);
  return isListingMaintainer({ scope: null, memberScopes: [], maintainers, login: user.login });
}
