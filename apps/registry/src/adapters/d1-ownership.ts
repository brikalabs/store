import type { OwnershipPolicy, PublishIdentity } from "@brika/registry-core";
import { type Db, regScopes } from "@brika/store-db";
import { eq } from "drizzle-orm";

function scopeOf(name: string): string | null {
  return name.startsWith("@") ? (name.split("/")[0] ?? null) : null;
}

/**
 * Scope-based ownership: a scope is owned by one provider-qualified identity
 * (`provider` + owner id), claimed on first publish. Subsequent publishes must come
 * from that same identity. Anchored on the verified credential (OIDC `repository_owner`
 * or a publish token), so it cannot be spoofed.
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
      // First publish under an unclaimed scope claims it for this identity.
      await this.#db
        .insert(regScopes)
        .values({ scope, ownerProvider: identity.provider, ownerId: identity.owner })
        .onConflictDoNothing();
      return { ok: true };
    }
    if (owner.ownerProvider !== identity.provider || owner.ownerId !== identity.owner) {
      return { ok: false, message: `scope ${scope} is owned by ${owner.ownerId}` };
    }
    return { ok: true };
  }
}
