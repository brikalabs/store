import { inject } from "@brika/di";
import { RegistryDb } from "@brika/registry-runtime";
import {
  listPackageNamesForScopes,
  listScopesForMember,
  type MemberScope,
} from "@brika/store-db/adapters";

/** The web's reads over the registry's `reg_*` scope/ownership tables (the scope IS the ownership entity). */
export class ScopeMembershipStore {
  readonly #db = inject(RegistryDb);

  /** The scopes the account `userId` belongs to, each with the member's role. */
  listScopesForMember(userId: string): Promise<MemberScope[]> {
    return listScopesForMember(this.#db, userId);
  }

  /** The package names owned by any of `scopes`. */
  listPackageNamesForScopes(scopes: string[]): Promise<string[]> {
    return listPackageNamesForScopes(this.#db, scopes);
  }
}
