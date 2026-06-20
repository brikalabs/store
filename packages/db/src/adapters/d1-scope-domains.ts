import type { ScopeDomainRecord, ScopeDomains, ScopeScopedDomain } from "@brika/registry-core";
import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { regScopeDomains } from "../schema";

/**
 * Cloudflare D1 implementation of the {@link ScopeDomains} port (the `reg_scope_domains`
 * table): claim a domain, then flip `verified` once its derived challenge TXT is found in
 * DNS (ORG-010). No challenge is stored - it is recomputed statelessly from a secret.
 */
export class D1ScopeDomains implements ScopeDomains {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async list(scope: string): Promise<ScopeDomainRecord[]> {
    const rows = await this.#db
      .select({ domain: regScopeDomains.domain, verified: regScopeDomains.verified })
      .from(regScopeDomains)
      .where(eq(regScopeDomains.scope, scope))
      .orderBy(regScopeDomains.domain);
    return rows;
  }

  async get(scope: string, domain: string): Promise<ScopeDomainRecord | null> {
    const rows = await this.#db
      .select({ domain: regScopeDomains.domain, verified: regScopeDomains.verified })
      .from(regScopeDomains)
      .where(and(eq(regScopeDomains.scope, scope), eq(regScopeDomains.domain, domain)))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Insert the claim (unverified) if absent (race-safe), then read back the record. */
  async add(scope: string, domain: string): Promise<ScopeDomainRecord> {
    await this.#db.insert(regScopeDomains).values({ scope, domain }).onConflictDoNothing();
    const persisted = await this.get(scope, domain);
    if (persisted === null) throw new Error(`domain ${domain} vanished after add`);
    return persisted;
  }

  async setVerified(scope: string, domain: string, verified: boolean): Promise<void> {
    await this.#db
      .update(regScopeDomains)
      .set({ verified, verifiedAt: verified ? Math.floor(Date.now() / 1000) : null })
      .where(and(eq(regScopeDomains.scope, scope), eq(regScopeDomains.domain, domain)));
  }

  async remove(scope: string, domain: string): Promise<boolean> {
    const deleted = await this.#db
      .delete(regScopeDomains)
      .where(and(eq(regScopeDomains.scope, scope), eq(regScopeDomains.domain, domain)))
      .returning({ domain: regScopeDomains.domain });
    return deleted.length > 0;
  }

  async listAllVerified(): Promise<ScopeScopedDomain[]> {
    return this.#db
      .select({ scope: regScopeDomains.scope, domain: regScopeDomains.domain })
      .from(regScopeDomains)
      .where(eq(regScopeDomains.verified, true))
      .orderBy(regScopeDomains.scope, regScopeDomains.domain);
  }
}
