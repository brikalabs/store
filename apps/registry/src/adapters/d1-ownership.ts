import type { OwnershipPolicy, PublishIdentity } from "@brika/registry-core";
import { type Db, regScopes } from "@brika/store-db";
import { eq } from "drizzle-orm";

function scopeOf(name: string): string | null {
  return name.startsWith("@") ? (name.split("/")[0] ?? null) : null;
}

/**
 * Scope-based ownership: a scope is owned by one GitHub owner, claimed on first
 * publish. Subsequent publishes must come from that same owner. Anchored on the
 * verified OIDC `repository_owner`, so it cannot be spoofed.
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
      // First publish under an unclaimed scope claims it for this GitHub owner.
      await this.#db
        .insert(regScopes)
        .values({ scope, githubOwner: identity.owner })
        .onConflictDoNothing();
      return { ok: true };
    }
    if (owner.githubOwner !== identity.owner) {
      return { ok: false, message: `scope ${scope} is owned by ${owner.githubOwner}` };
    }
    return { ok: true };
  }
}
