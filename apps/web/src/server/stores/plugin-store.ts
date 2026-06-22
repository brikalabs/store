import { inject } from "@brika/di";
import type { PluginDetail, RatingSummary } from "@brika/registry-contract";
import { eq, sql } from "drizzle-orm";
import { Database } from "@/server/db/client";
import { plugins, reviews } from "@/server/db/schema";

/**
 * Repository for the `plugins` cache table - the relational mirror of a published package that
 * reviews/comments reference (the registry stays the source of truth for code). Also owns the
 * denormalized rating fields, recomputed from the review rows whenever a review changes.
 */
export class PluginStore {
  readonly #db = inject(Database);

  /** Whether a cache row already exists for this package. */
  async exists(name: string): Promise<boolean> {
    const rows = await this.#db
      .select({ name: plugins.name })
      .from(plugins)
      .where(eq(plugins.name, name))
      .limit(1);
    return rows[0] !== undefined;
  }

  /** Insert a cache row from a resolved registry detail (no-op if it already exists). */
  async insertFromDetail(detail: PluginDetail): Promise<void> {
    await this.#db
      .insert(plugins)
      .values({
        name: detail.name,
        displayName: detail.displayName,
        description: detail.description,
        latestVersion: detail.version,
        repository: detail.repository,
        homepage: detail.homepage,
        license: detail.license,
        keywords: detail.keywords,
        authorId: detail.author?.id,
        downloadsWeekly: detail.downloadsWeekly,
        brikaEngine: detail.brikaEngine,
        capabilities: detail.capabilities,
        grants: detail.grants,
      })
      .onConflictDoNothing();
  }

  /** Refresh the denormalized rating from the authoritative review rows. */
  async recomputeRating(pluginName: string): Promise<void> {
    const rows = await this.#db
      .select({ average: sql<number>`avg(${reviews.rating})`, count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.pluginName, pluginName));
    const row = rows[0];
    await this.#db
      .update(plugins)
      .set({ ratingAverage: row?.average ?? 0, ratingCount: row?.count ?? 0 })
      .where(eq(plugins.name, pluginName));
  }

  /** The rating summary for a package, or undefined when it has no reviews. */
  async ratingSummary(pluginName: string): Promise<RatingSummary | undefined> {
    const rows = await this.#db
      .select({ average: plugins.ratingAverage, count: plugins.ratingCount })
      .from(plugins)
      .where(eq(plugins.name, pluginName))
      .limit(1);
    const row = rows[0];
    if (row === undefined || row.count === 0) return undefined;
    return { average: row.average, count: row.count };
  }
}
