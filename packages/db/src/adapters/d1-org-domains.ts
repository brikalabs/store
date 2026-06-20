import type { OrgDomainRecord, OrgDomains, OrgScopedDomain } from "@brika/registry-core";
import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { regOrgDomains } from "../schema";

/**
 * Cloudflare D1 implementation of the {@link OrgDomains} port (the `reg_org_domains`
 * table): claim a domain, then flip `verified` once its derived challenge TXT is found in
 * DNS (ORG-010). No challenge is stored - it is recomputed statelessly from a secret.
 */
export class D1OrgDomains implements OrgDomains {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  async list(slug: string): Promise<OrgDomainRecord[]> {
    const rows = await this.#db
      .select({ domain: regOrgDomains.domain, verified: regOrgDomains.verified })
      .from(regOrgDomains)
      .where(eq(regOrgDomains.orgSlug, slug))
      .orderBy(regOrgDomains.domain);
    return rows;
  }

  async get(slug: string, domain: string): Promise<OrgDomainRecord | null> {
    const rows = await this.#db
      .select({ domain: regOrgDomains.domain, verified: regOrgDomains.verified })
      .from(regOrgDomains)
      .where(and(eq(regOrgDomains.orgSlug, slug), eq(regOrgDomains.domain, domain)))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Insert the claim (unverified) if absent (race-safe), then read back the record. */
  async add(slug: string, domain: string): Promise<OrgDomainRecord> {
    await this.#db.insert(regOrgDomains).values({ orgSlug: slug, domain }).onConflictDoNothing();
    const persisted = await this.get(slug, domain);
    if (persisted === null) throw new Error(`domain ${domain} vanished after add`);
    return persisted;
  }

  async setVerified(slug: string, domain: string, verified: boolean): Promise<void> {
    await this.#db
      .update(regOrgDomains)
      .set({ verified, verifiedAt: verified ? Math.floor(Date.now() / 1000) : null })
      .where(and(eq(regOrgDomains.orgSlug, slug), eq(regOrgDomains.domain, domain)));
  }

  async remove(slug: string, domain: string): Promise<boolean> {
    const deleted = await this.#db
      .delete(regOrgDomains)
      .where(and(eq(regOrgDomains.orgSlug, slug), eq(regOrgDomains.domain, domain)))
      .returning({ domain: regOrgDomains.domain });
    return deleted.length > 0;
  }

  async listAllVerified(): Promise<OrgScopedDomain[]> {
    return this.#db
      .select({ orgSlug: regOrgDomains.orgSlug, domain: regOrgDomains.domain })
      .from(regOrgDomains)
      .where(eq(regOrgDomains.verified, true))
      .orderBy(regOrgDomains.orgSlug, regOrgDomains.domain);
  }
}
