import type { OwnershipPolicy, PublishIdentity } from "@brika/registry-core";
import { type Db, regScopes } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { scopeOf } from "../names";
import { D1ScopeMembers } from "./d1-scope-members";

/**
 * Membership-based publish authorization: a scope must be explicitly CREATED (see the
 * scope controller), and only its MEMBERS may publish under it (any role; admins also
 * manage the scope). Publishing never claims a scope implicitly. Anchored on the
 * verified credential (OIDC `repository_owner` or a publish token), so it cannot be
 * spoofed.
 */
export class D1OwnershipPolicy implements OwnershipPolicy {
  readonly #db: Db;
  readonly #members: D1ScopeMembers;

  constructor(db: Db) {
    this.#db = db;
    this.#members = new D1ScopeMembers(db);
  }

  async canPublish(
    identity: PublishIdentity,
    name: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const scope = scopeOf(name);
    if (scope === null) {
      return { ok: false, message: "only scoped packages (@scope/name) can be published" };
    }

    const member = { provider: identity.provider, id: identity.owner };
    if ((await this.#members.roleOf(scope, member)) !== null) return { ok: true };

    // Not a member: distinguish an unknown scope (create it first) from a real scope the
    // caller has no membership in.
    const rows = await this.#db
      .select({ scope: regScopes.scope })
      .from(regScopes)
      .where(eq(regScopes.scope, scope))
      .limit(1);
    return rows[0] === undefined
      ? { ok: false, message: `scope ${scope} does not exist; create it first` }
      : { ok: false, message: `you are not a member of ${scope}` };
  }
}
