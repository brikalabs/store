import { inject } from "@brika/di";
import {
  listPackageNamesForScopes,
  listScopesForMember,
  type MemberScope,
} from "@brika/store-db/adapters";
import { RegistryDatabase } from "@/server/registry-services";

/**
 * The web's reads over the registry's `reg_*` scope/ownership tables (the scope IS the ownership
 * entity). The one place the web touches that schema for membership, so a route asks
 * `inject(ScopeMembershipStore).listScopesForMember(...)` instead of threading the raw drizzle
 * client through a free function.
 */
export class ScopeMembershipStore {
  readonly #db = inject(RegistryDatabase).orm;

  /** The scopes `provider:memberId` belongs to, each with the member's role. */
  listScopesForMember(provider: string, memberId: string): Promise<MemberScope[]> {
    return listScopesForMember(this.#db, provider, memberId);
  }

  /** The package names owned by any of `scopes`. */
  listPackageNamesForScopes(scopes: string[]): Promise<string[]> {
    return listPackageNamesForScopes(this.#db, scopes);
  }
}
