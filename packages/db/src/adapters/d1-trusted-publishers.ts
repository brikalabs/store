import { inject } from "@brika/di";
import type { TrustedPublisher, TrustedPublishers } from "@brika/registry-core";
import { and, eq } from "drizzle-orm";
import { Db } from "../client";
import { regTrustedPublishers } from "../schema";

/** Cloudflare D1 implementation of {@link TrustedPublishers} (`reg_trusted_publishers`). */
export class D1TrustedPublishers implements TrustedPublishers {
  readonly #db = inject(Db);

  async listForScope(scope: string): Promise<TrustedPublisher[]> {
    const rows = await this.#db
      .select()
      .from(regTrustedPublishers)
      .where(eq(regTrustedPublishers.scope, scope));
    return rows.map((r) => ({
      scope: r.scope,
      provider: r.provider,
      repository: r.repository,
      workflow: r.workflow,
    }));
  }

  async add(binding: TrustedPublisher): Promise<TrustedPublisher> {
    await this.#db.insert(regTrustedPublishers).values(binding).onConflictDoNothing();
    return binding;
  }

  async remove(
    scope: string,
    provider: string,
    repository: string,
    workflow: string,
  ): Promise<boolean> {
    const removed = await this.#db
      .delete(regTrustedPublishers)
      .where(
        and(
          eq(regTrustedPublishers.scope, scope),
          eq(regTrustedPublishers.provider, provider),
          eq(regTrustedPublishers.repository, repository),
          eq(regTrustedPublishers.workflow, workflow),
        ),
      )
      .returning();
    return removed.length > 0;
  }
}
