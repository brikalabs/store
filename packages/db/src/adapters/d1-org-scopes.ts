import type { OrgScopes } from "@brika/registry-core";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { regScopes } from "../schema";

/**
 * Cloudflare D1 implementation of the {@link OrgScopes} port: the 1:N link between an org
 * and the npm scopes it owns (the `reg_scopes.org_id` FK). A scope row is created when the
 * scope is attached to an org.
 */
export class D1OrgScopes implements OrgScopes {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async scopesForOrg(slug: string): Promise<string[]> {
    const rows = await this.#db
      .select({ scope: regScopes.scope })
      .from(regScopes)
      .where(eq(regScopes.orgId, slug))
      .orderBy(regScopes.scope);
    return rows.map((row) => row.scope);
  }

  async orgForScope(scope: string): Promise<string | null> {
    const rows = await this.#db
      .select({ orgId: regScopes.orgId })
      .from(regScopes)
      .where(eq(regScopes.scope, scope))
      .limit(1);
    return rows[0]?.orgId ?? null;
  }

  /**
   * Race-safe attach: insert `(scope, orgSlug)` only if the scope is unattached, then read
   * back the owning org. `onConflictDoNothing` keeps the first writer's row (the insert is
   * the serialization point under D1/SQLite's single writer), so a caller trying to attach
   * an already-owned scope reads back the current owner and can detect the conflict.
   */
  async attach(scope: string, orgSlug: string): Promise<{ scope: string; orgSlug: string }> {
    await this.#db.insert(regScopes).values({ scope, orgId: orgSlug }).onConflictDoNothing();
    const owner = await this.orgForScope(scope);
    if (owner === null) throw new Error(`scope ${scope} vanished after attach`);
    return { scope, orgSlug: owner };
  }
}
