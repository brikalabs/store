import type { OwnershipPolicy, PublishIdentity } from "@brika/registry-core";
import { type Db, regScopes } from "@brika/store-db";
import { eq } from "drizzle-orm";

function scopeOf(name: string): string | null {
  return name.startsWith("@") ? (name.split("/")[0] ?? null) : null;
}

/** Does this scope row belong to the given provider-qualified identity? */
function ownedBy(
  row: { ownerProvider: string; ownerId: string },
  identity: PublishIdentity,
): boolean {
  return row.ownerProvider === identity.provider && row.ownerId === identity.owner;
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

  async #read(scope: string): Promise<{ ownerProvider: string; ownerId: string } | undefined> {
    const rows = await this.#db.select().from(regScopes).where(eq(regScopes.scope, scope)).limit(1);
    return rows[0];
  }

  async canPublish(
    identity: PublishIdentity,
    name: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const scope = scopeOf(name);
    if (scope === null) {
      return { ok: false, message: "only scoped packages (@scope/name) can be published" };
    }

    const existing = await this.#read(scope);
    if (existing !== undefined) {
      return ownedBy(existing, identity)
        ? { ok: true }
        : { ok: false, message: `scope ${scope} is owned by ${existing.ownerId}` };
    }

    // Unclaimed: claim it, then RE-READ before trusting the claim. `onConflictDoNothing`
    // keeps the first writer's row, so if two different identities race the first publish
    // to the same scope, the loser reads back the winner's row and is rejected here rather
    // than wrongly proceeding to publish under a scope it does not own. The insert is the
    // serialization point (D1/SQLite has a single writer), so the re-read is authoritative.
    await this.#db
      .insert(regScopes)
      .values({ scope, ownerProvider: identity.provider, ownerId: identity.owner })
      .onConflictDoNothing();
    const claimed = await this.#read(scope);
    if (claimed === undefined || !ownedBy(claimed, identity)) {
      return {
        ok: false,
        message: `scope ${scope} is owned by ${claimed?.ownerId ?? "another account"}`,
      };
    }
    return { ok: true };
  }
}
