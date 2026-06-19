import type { OwnershipPolicy, PublishIdentity } from "@brika/registry-core";
import { type Db, regScopes } from "@brika/store-db";
import { eq } from "drizzle-orm";
import { ownedBy, scopeOf } from "../names";

/**
 * Scope-based ownership: a scope is owned by one provider-qualified identity
 * (`provider` + owner id), set when the scope is explicitly CREATED (see the scope
 * controller). Publishing never claims a scope implicitly: an unknown scope is
 * rejected, and a known one must belong to the publisher. Anchored on the verified
 * credential (OIDC `repository_owner` or a publish token), so it cannot be spoofed.
 */
export class D1OwnershipPolicy implements OwnershipPolicy {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async canPublish(
    identity: PublishIdentity,
    name: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const scope = scopeOf(name);
    if (scope === null) {
      return { ok: false, message: "only scoped packages (@scope/name) can be published" };
    }

    const rows = await this.#db.select().from(regScopes).where(eq(regScopes.scope, scope)).limit(1);
    const owner = rows[0];
    if (owner === undefined) {
      return { ok: false, message: `scope ${scope} does not exist; create it first` };
    }
    return ownedBy(owner, identity)
      ? { ok: true }
      : { ok: false, message: `scope ${scope} is owned by ${owner.ownerId}` };
  }
}
